import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './prisma-client';

/**
 * Variante do client para Cloudflare Workers. `scripts/cf-build.mjs` copia este
 * arquivo por cima de `prisma.ts` durante o build. Ver `prisma-client.ts`.
 *
 * A diferença para a versão de Node NÃO é o driver — é o CICLO DE VIDA.
 *
 * No Node, um único client no escopo do módulo é o padrão recomendado: a conexão
 * é reaproveitada entre requisições. No workerd isso é proibido — o escopo do
 * módulo sobrevive entre requisições, mas objetos de I/O não:
 *
 *     Cannot perform I/O on behalf of a different request.
 *
 * A conexão WebSocket do driver Neon nasce na requisição A e explode ao ser usada
 * na B. Foi exatamente o que derrubou /api/organizations, /imports/qdd/pending e
 * /government-structure/diff, enquanto as rotas que caíram em isolate novo
 * respondiam normalmente — daí o sintoma intermitente.
 *
 * Por que não trocar para o adaptador HTTP, que não tem socket persistente: ele
 * não faz transação interativa, e `$transaction` é usada na curadoria temática,
 * na recuperação de senha, na estrutura de governo e na importação de QDD. A
 * Cloudflare viraria só-leitura na prática.
 *
 * Então: um client POR REQUISIÇÃO, com o `ctx` do OpenNext como chave. O WeakMap
 * solta o client quando a requisição é coletada. Sem contexto (build, prerender),
 * cai num client avulso, que é o comportamento seguro.
 */
function novoClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env['DATABASE_URL']! }),
  });
}

const porRequisicao = new WeakMap<object, PrismaClient>();

function clientDaRequisicao(): PrismaClient {
  let chave: object | null = null;
  try {
    chave = getCloudflareContext({ async: false })?.ctx ?? null;
  } catch {
    chave = null;
  }
  if (!chave) return novoClient();

  const existente = porRequisicao.get(chave);
  if (existente) return existente;

  const criado = novoClient();
  porRequisicao.set(chave, criado);
  return criado;
}

/**
 * Proxy para as ~45 rotas seguirem importando `prisma` como valor de módulo, sem
 * saber que por baixo há um client por requisição. Métodos são religados ao client
 * de origem para não perderem o `this` — inclusive `$transaction`, que assim roda
 * inteira sobre a MESMA conexão.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_alvo, prop) {
    const client = clientDaRequisicao() as unknown as Record<string | symbol, unknown>;
    const valor = client[prop];
    return typeof valor === 'function' ? valor.bind(client) : valor;
  },
});
