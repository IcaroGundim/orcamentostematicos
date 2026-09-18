/**
 * Gerador de carga do cenário "dia de prazo do ciclo".
 *
 * Node puro, sem dependência nem instalação: a rede da SEPLAN bloqueia domínio não
 * categorizado (FortiGate), e baixar o binário do k6 costuma esbarrar nisso.
 *
 * Cada usuário virtual é um usuário REAL do targets.json, com sessão já aberta —
 * o teste não passa pelo login, que serializa por conta num advisory lock e
 * mediria o lock em vez da aplicação.
 *
 * Uso:
 *   BASE_URL=http://localhost:3000 node scripts/loadtest/drive.mjs
 *   BASE_URL=... STAGES="10:30,50:60,100:60,0:10" node scripts/loadtest/drive.mjs
 *
 * STAGES: pares "usuários:segundos" separados por vírgula. O padrão faz uma rampa
 * de 5 a 120 usuários simultâneos.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const STAGES = (process.env.STAGES ?? '5:20,20:40,50:60,100:60,120:60,0:5')
  .split(',')
  .map((s) => {
    const [vus, secs] = s.split(':').map(Number);
    return { vus, secs };
  });

/**
 * Trava: o alvo precisa ser um build local ou um preview. Estes hosts são o
 * sistema em uso pelas secretarias.
 */
const HOSTS_PROIBIDOS = ['orcamentostematicos.vercel.app', 'orcamentostematicos.'];
if (!process.env.PERMITIR_PRODUCAO) {
  for (const h of HOSTS_PROIBIDOS) {
    if (new URL(BASE_URL).hostname.includes(h)) {
      console.error(`\n  ABORTADO: ${BASE_URL} é o ambiente de produção.\n`);
      process.exit(1);
    }
  }
}

let alvos;
try {
  alvos = JSON.parse(await readFile(path.join(HERE, 'targets.json'), 'utf8'));
} catch {
  console.error(
    '\n  ABORTADO: targets.json não encontrado.\n' +
      '  Rode primeiro: LOADTEST_DATABASE_URL="<branch>" node scripts/loadtest/prepare.mjs\n',
  );
  process.exit(1);
}
const ANO = alvos.year;
const secretarias = alvos.usuarios.filter((u) => u.role === 'SECRETARIA_REPRESENTANTE' && u.validations.length);
const seplan = alvos.usuarios.filter((u) => u.role === 'SEPLAN_ADMIN');

if (!secretarias.length) {
  console.error('\n  ABORTADO: targets.json não tem representante com validação aberta. Rode o prepare.\n');
  process.exit(1);
}

// ---------------------------------------------------------------- métricas

const amostras = new Map(); // etiqueta -> { lat: number[], erros: number, status: Map }

function registrar(etiqueta, ms, status, erro) {
  let m = amostras.get(etiqueta);
  if (!m) {
    m = { lat: [], erros: 0, status: new Map() };
    amostras.set(etiqueta, m);
  }
  m.lat.push(ms);
  if (erro) m.erros += 1;
  m.status.set(status, (m.status.get(status) ?? 0) + 1);
}

function percentil(ordenado, p) {
  if (!ordenado.length) return 0;
  const i = Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1);
  return ordenado[i];
}

// ---------------------------------------------------------------- requisição

async function chamar(etiqueta, url, token, init = {}) {
  const t0 = performance.now();
  let status = 0;
  let erro = false;
  try {
    const r = await fetch(`${BASE_URL}${url}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    status = r.status;
    // Drenar o corpo: sem isso a conexão não é liberada e a medição distorce.
    await r.arrayBuffer();
    erro = !r.ok;
  } catch (e) {
    erro = true;
    status = e?.cause?.code ?? 'ERRO_REDE';
  }
  const ms = performance.now() - t0;
  registrar(etiqueta, ms, status, erro);
  return { status, erro };
}

const sortear = (a) => a[Math.floor(Math.random() * a.length)];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Prova de que o SERVIDOR está ligado ao banco de teste.
 *
 * Guardar o host não basta: `BASE_URL=localhost` passa na trava enquanto o
 * `npm start` pode estar conectado ao Neon de produção, se o `DATABASE_URL` da
 * linha de comando não vencer o `.env.local`. Seria exatamente o desastre que
 * este arsenal existe para evitar.
 *
 * Os tokens do targets.json só existem no branch de teste. Se um deles autentica,
 * o servidor está no branch certo — é prova, não suposição sobre precedência de
 * variável de ambiente.
 */
async function conferirBanco() {
  const u = secretarias[0];
  let r;
  try {
    r = await fetch(`${BASE_URL}/api/validations/my?exercicio=${ANO}`, {
      headers: { authorization: `Bearer ${u.token}` },
    });
  } catch (e) {
    console.error(`\n  ABORTADO: ${BASE_URL} não respondeu (${e.message}). O servidor está no ar?\n`);
    process.exit(1);
  }
  if (r.status === 401) {
    console.error(
      '\n  ABORTADO: o servidor NÃO reconheceu a sessão de teste.\n' +
        `  Isso significa que ${BASE_URL} está ligado a OUTRO banco — provavelmente produção.\n` +
        '  Suba o servidor com o DATABASE_URL do branch de teste e confira se ele vence o .env.local.\n',
    );
    process.exit(1);
  }
  if (!r.ok) {
    console.error(`\n  ABORTADO: verificação devolveu HTTP ${r.status}. Esperado 200.\n`);
    process.exit(1);
  }
  console.log('Verificação: o servidor reconhece a sessão de teste — banco correto.\n');
}

// ---------------------------------------------------------------- cenários

/**
 * Representante de secretaria no dia do prazo: abre a lista de entregas, edita
 * um rascunho, e de vez em quando envia. A proporção reflete o uso real — muita
 * leitura e edição para cada envio.
 */
async function jornadaSecretaria(u, ativo) {
  while (ativo.on) {
    await chamar('GET /validations/my', `/api/validations/my?exercicio=${ANO}`, u.token);
    if (!ativo.on) break;

    const id = sortear(u.validations);
    const corpo = JSON.stringify({
      realizedDescription: `Execução informada no teste de carga ${Date.now()}`,
      observations: 'carga',
      // Entrega COMPLETA segundo `strictDeliverySchema` em validation-schema.ts:
      // sem `beneficiaries` e sem um município válido do Acre, o submit-all
      // classificaria a linha como incompleta e pularia o caminho de escrita —
      // o teste passaria sem exercitar o que interessa.
      deliveries: [
        {
          name: 'Entrega de teste',
          description: 'Gerada pelo teste de carga',
          quantity: 1,
          executedValue: 1000,
          municipality: 'Rio Branco',
          beneficiaries: 'População atendida pelo teste de carga',
        },
      ],
    });
    await chamar('PATCH /validations/:id/draft', `/api/validations/${id}/draft`, u.token, {
      method: 'PATCH',
      body: corpo,
    });
    if (!ativo.on) break;

    // 1 envio a cada ~10 edições, como no uso real.
    if (Math.random() < 0.1) {
      await chamar('POST /validations/:id/submit', `/api/validations/${id}/submit`, u.token, {
        method: 'POST',
      });
    }

    // O "enviar tudo" é o gesto típico do fim do prazo e o caminho de escrita mais
    // caro: varre todas as validações da secretaria, valida cada uma em memória e
    // grava em lote. Raro por usuário, mas é o que satura o banco no pico.
    if (Math.random() < 0.03) {
      await chamar('POST /validations/submit-all', '/api/validations/submit-all', u.token, {
        method: 'POST',
      });
    }

    // Pausa entre ações: pessoa lendo a tela, não robô em laço fechado.
    await dormir(300 + Math.random() * 700);
  }
}

/** SEPLAN acompanhando o painel enquanto as secretarias enviam. */
async function jornadaSeplan(u, ativo) {
  while (ativo.on) {
    await chamar('GET /reports/summary', `/api/reports/summary?exercicio=${ANO}`, u.token);
    if (!ativo.on) break;
    await chamar('GET /budget-actions', `/api/budget-actions?exercicio=${ANO}`, u.token);
    await dormir(1000 + Math.random() * 2000);
  }
}

// ---------------------------------------------------------------- execução

console.log(`Alvo:       ${BASE_URL}`);
console.log(`Exercício:  ${ANO}`);
console.log(`Disponível: ${secretarias.length} representantes, ${seplan.length} SEPLAN`);
console.log(`Rampa:      ${STAGES.map((s) => `${s.vus}v/${s.secs}s`).join(' -> ')}\n`);

await conferirBanco();

const pico = Math.max(...STAGES.map((s) => s.vus));
if (pico > secretarias.length) {
  console.log(
    `AVISO: o pico da rampa (${pico}) supera as ${secretarias.length} secretarias distintas\n` +
      '       com trabalho aberto. Acima desse ponto os usuários virtuais compartilham conta\n' +
      '       e linha, e parte do que for medido é disputa de lock, não capacidade.\n' +
      '       Para ampliar o conjunto: prepare.mjs --deadline\n',
  );
}

const emVoo = [];
const inicio = Date.now();

for (const estagio of STAGES) {
  // ~15% dos usuários simultâneos são SEPLAN olhando painel; o resto, secretarias.
  const alvoSeplan = Math.min(seplan.length, Math.round(estagio.vus * 0.15));
  const alvoSec = estagio.vus - alvoSeplan;

  while (emVoo.length > estagio.vus) {
    const v = emVoo.pop();
    v.ativo.on = false;
  }
  const atuaisSec = emVoo.filter((v) => v.tipo === 'sec').length;
  const atuaisSeplan = emVoo.filter((v) => v.tipo === 'seplan').length;

  for (let i = atuaisSec; i < alvoSec; i += 1) {
    const ativo = { on: true };
    const u = secretarias[i % secretarias.length];
    emVoo.push({ tipo: 'sec', ativo, p: jornadaSecretaria(u, ativo) });
  }
  for (let i = atuaisSeplan; i < alvoSeplan; i += 1) {
    const ativo = { on: true };
    const u = seplan[i % seplan.length];
    emVoo.push({ tipo: 'seplan', ativo, p: jornadaSeplan(u, ativo) });
  }

  const total = [...amostras.values()].reduce((s, m) => s + m.lat.length, 0);
  console.log(
    `[${String(Math.round((Date.now() - inicio) / 1000)).padStart(4)}s] ` +
      `${String(estagio.vus).padStart(4)} usuários simultâneos por ${estagio.secs}s ` +
      `(requisições até aqui: ${total})`,
  );
  await dormir(estagio.secs * 1000);
}

for (const v of emVoo) v.ativo.on = false;
await Promise.allSettled(emVoo.map((v) => v.p));

// ---------------------------------------------------------------- relatório

const duracao = (Date.now() - inicio) / 1000;
console.log(`\n${'='.repeat(96)}`);
console.log(`RESULTADO — ${duracao.toFixed(0)}s de carga contra ${BASE_URL}`);
console.log('='.repeat(96));
console.log(
  'endpoint'.padEnd(34) +
    'reqs'.padStart(8) +
    'erros'.padStart(8) +
    'p50'.padStart(9) +
    'p95'.padStart(9) +
    'p99'.padStart(9) +
    'max'.padStart(9),
);
console.log('-'.repeat(96));

let totalReqs = 0;
let totalErros = 0;
for (const [etiqueta, m] of [...amostras.entries()].sort()) {
  const ord = [...m.lat].sort((a, b) => a - b);
  totalReqs += m.lat.length;
  totalErros += m.erros;
  console.log(
    etiqueta.padEnd(34) +
      String(m.lat.length).padStart(8) +
      String(m.erros).padStart(8) +
      `${percentil(ord, 50).toFixed(0)}ms`.padStart(9) +
      `${percentil(ord, 95).toFixed(0)}ms`.padStart(9) +
      `${percentil(ord, 99).toFixed(0)}ms`.padStart(9) +
      `${ord[ord.length - 1].toFixed(0)}ms`.padStart(9),
  );
}
console.log('-'.repeat(96));
console.log(
  `TOTAL: ${totalReqs} requisições, ${totalErros} erros ` +
    `(${((totalErros / Math.max(1, totalReqs)) * 100).toFixed(2)}%), ` +
    `${(totalReqs / duracao).toFixed(1)} req/s médias`,
);

console.log('\nStatus HTTP por endpoint:');
for (const [etiqueta, m] of [...amostras.entries()].sort()) {
  const partes = [...m.status.entries()].sort().map(([s, n]) => `${s}:${n}`).join('  ');
  console.log(`  ${etiqueta.padEnd(34)} ${partes}`);
}
console.log(
  '\nLembrete: rode `node scripts/loadtest/prepare.mjs --reset` para devolver as\n' +
    'validações ao estado anterior antes da próxima bateria.',
);
