import 'server-only';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * O app roda em DOIS lugares, com runtimes diferentes:
 *
 *  - Vercel (Node): `@prisma/adapter-pg`, sobre `pg` e socket TCP. É o caminho já
 *    validado, e o único que a coleta diária do SICAF usa hoje.
 *  - Cloudflare Workers: `@prisma/adapter-neon`, sobre o driver serverless do Neon.
 *    O `pg` é pacote Node puro (sem condição de export `workerd`), então depender
 *    dele no Worker seria apostar num shim não suportado.
 *
 * A escolha é por runtime, e NÃO por variável de ambiente, de propósito: variável
 * esquecida num dos dois deployments daria falha silenciosa na conexão. O marcador
 * `navigator.userAgent` é o que o próprio Workers expõe para essa distinção.
 *
 * Por que não migrar tudo para o driver do Neon: a Vercel é a instância que recebe a
 * publicação automática diária, com transação interativa e `pg_advisory_xact_lock`
 * dentro de uma janela de 60s. Trocar o transporte dela por WebSocket para conveniência
 * do Worker mexeria justamente na peça que passou a rodar sem ninguém olhando.
 */
function isCloudflareWorkers() {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
}

function createPrisma() {
  const connectionString = process.env['DATABASE_URL']!;
  const adapter = isCloudflareWorkers()
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
