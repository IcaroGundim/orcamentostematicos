/**
 * Prepara um banco ISOLADO para o teste de carga do "dia de prazo do ciclo".
 *
 * Cria um usuário de teste por executor real (`ExerciseUnitExecutor`), abre a
 * sessão de cada um direto na tabela `Session` e escreve `targets.json` com os
 * tokens e as validações que cada usuário de fato controla.
 *
 * Por que a sessão é inserida direto no banco, e não pela rota de login: o
 * `/api/auth/login` serializa as tentativas da MESMA conta num
 * `pg_advisory_xact_lock`. Um teste que loga a cada iteração mede esse lock, não
 * a aplicação. Usuário real loga uma vez e depois faz centenas de requisições
 * autenticadas — é isso que o teste reproduz.
 *
 * Uso:
 *   LOADTEST_DATABASE_URL="postgres://...branch-de-teste..." node scripts/loadtest/prepare.mjs
 *   ... node scripts/loadtest/prepare.mjs --reset   # devolve as validações ao estado inicial
 *   ... node scripts/loadtest/prepare.mjs --clean   # remove usuários e sessões de teste
 */

import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGETS_FILE = path.join(HERE, 'targets.json');
const BASELINE_FILE = path.join(HERE, 'baseline.json');

/**
 * Trava de segurança. Este é o endpoint do Neon de PRODUÇÃO: o banco único, com
 * retenção point-in-time de ~6h, que já perdeu toda a curadoria uma vez. Gerar
 * carga contra ele grava sessões, consome o pool de conexões e derruba o sistema
 * para os usuários reais. Se o endpoint aparecer na string, o script aborta.
 */
const ENDPOINTS_PROIBIDOS = ['ep-broad-hill-aq5czied'];

const TEST_EMAIL_DOMAIN = 'carga.teste.local';
const TOKEN_PREFIX = 'loadtest-';

function abortar(mensagem) {
  console.error(`\n  ABORTADO: ${mensagem}\n`);
  process.exit(1);
}

function conexaoDeTeste() {
  const url = process.env.LOADTEST_DATABASE_URL;
  if (!url) {
    abortar(
      'Defina LOADTEST_DATABASE_URL com a string do branch isolado.\n' +
        '  Este script NUNCA usa DATABASE_URL, justamente para não cair em produção por descuido.',
    );
  }
  for (const proibido of ENDPOINTS_PROIBIDOS) {
    if (url.includes(proibido)) {
      abortar(
        `LOADTEST_DATABASE_URL aponta para o endpoint de PRODUÇÃO (${proibido}).\n` +
          '  Crie um branch isolado no Neon e use a string dele.',
      );
    }
  }
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) {
    abortar('LOADTEST_DATABASE_URL é idêntica a DATABASE_URL. Use um banco separado.');
  }
  return url;
}

/** Mesma regra de `getCurrentYear()` em src/lib/store.ts. */
async function exercicioCorrente(c) {
  const flagged = await c.query(
    'SELECT year FROM "FiscalYear" WHERE "isCurrent" = true ORDER BY year DESC',
  );
  if (flagged.rows[0]) return flagged.rows[0].year;
  const fallback = await c.query(
    'SELECT year FROM "BudgetImport" ORDER BY year DESC, "importedAt" DESC LIMIT 1',
  );
  return fallback.rows[0]?.year ?? null;
}

async function limpar(c) {
  const u = await c.query(`DELETE FROM "User" WHERE email LIKE $1`, [`%@${TEST_EMAIL_DOMAIN}`]);
  // Session tem onDelete: Cascade, então some junto com o usuário.
  console.log(`Removidos ${u.rowCount} usuários de teste (e suas sessões).`);
}

/** Colunas que o cenário de carga altera — todas precisam voltar no --reset. */
const COLUNAS_MUTAVEIS = [
  'status',
  'submittedAt',
  'realizedDescription',
  'observations',
  'deliveries',
  'informedExecutedValue',
];

async function capturarBaseline(c, year) {
  const r = await c.query(
    `SELECT v.id, v.status::text, v."submittedAt", v."realizedDescription",
            v.observations, v.deliveries, v."informedExecutedValue"
       FROM "ActionValidation" v
       JOIN "BudgetAction" a ON a.id = v."actionId"
      WHERE a.year = $1`,
    [year],
  );
  await writeFile(BASELINE_FILE, JSON.stringify(r.rows, null, 2));
  console.log(`Baseline gravado: ${r.rowCount} validações do exercício ${year}.`);
  return r.rows;
}

async function restaurar(c) {
  let baseline;
  try {
    baseline = JSON.parse(await readFile(BASELINE_FILE, 'utf8'));
  } catch {
    abortar('baseline.json não encontrado. Rode o prepare sem --reset primeiro.');
  }
  let n = 0;
  for (const linha of baseline) {
    const r = await c.query(
      `UPDATE "ActionValidation"
          SET status = $2::"ValidationStatus", "submittedAt" = $3, "realizedDescription" = $4,
              observations = $5, deliveries = $6, "informedExecutedValue" = $7
        WHERE id = $1`,
      [
        linha.id,
        linha.status,
        linha.submittedAt,
        linha.realizedDescription,
        linha.observations,
        JSON.stringify(linha.deliveries ?? []),
        linha.informedExecutedValue,
      ],
    );
    n += r.rowCount;
  }
  console.log(`Restauradas ${n} validações (${COLUNAS_MUTAVEIS.join(', ')}).`);

  // Restaurado o estado original, o baseline cumpriu seu papel. Apagá-lo libera o
  // próximo preparo — sem isso, a trava de sobrescrita barraria todas as baterias
  // seguintes e o ciclo preparar → medir → restaurar só rodaria uma vez.
  await rm(BASELINE_FILE, { force: true });
  console.log('baseline.json removido: o próximo prepare pode capturar um novo.');
}

async function preparar(c) {
  const year = await exercicioCorrente(c);
  if (year == null) abortar('Nenhum exercício com QDD importado neste banco.');
  console.log(`Exercício corrente no banco de teste: ${year}`);

  // Um usuário por executor: é exatamente o recorte que `getAllowedUnits` usa
  // para decidir o que a secretaria enxerga e pode escrever.
  const executores = await c.query(
    `SELECT DISTINCT "executorOrgCode" AS org, "executorUnitCode" AS unit
       FROM "ExerciseUnitExecutor"
      WHERE year = $1 AND "executorOrgCode" IS NOT NULL
      ORDER BY 1, 2`,
    [year],
  );
  if (!executores.rowCount) abortar(`Nenhum ExerciseUnitExecutor para ${year}.`);
  console.log(`Executores distintos (= secretarias simultâneas possíveis): ${executores.rowCount}`);

  // Antes de QUALQUER escrita, para o --reset conseguir desfazer tudo.
  await capturarBaseline(c, year);

  // Em produção boa parte das validações já está APROVADA, o que deixa poucas
  // unidades com trabalho aberto e concentra a carga em poucas linhas — isso
  // mediria disputa de lock de linha, não a aplicação. O --deadline reabre todas
  // para reproduzir um prazo de verdade, com todas as secretarias trabalhando.
  if (process.argv.includes('--deadline')) {
    const r = await c.query(
      `UPDATE "ActionValidation" v
          SET status = 'RASCUNHO', "submittedAt" = NULL
         FROM "BudgetAction" a
        WHERE a.id = v."actionId" AND a.year = $1 AND v.status <> 'RASCUNHO'`,
      [year],
    );
    console.log(`--deadline: ${r.rowCount} validações reabertas como RASCUNHO.`);
  }

  await limpar(c);

  const usuarios = [];

  // Representantes de secretaria — quem preenche e envia as entregas.
  for (const [i, row] of executores.rows.entries()) {
    const id = `carga_sec_${i}`;
    const email = `carga-sec-${i}@${TEST_EMAIL_DOMAIN}`;
    await c.query(
      `INSERT INTO "User" (id, name, email, username, password, role, "organizationCode", "unitCode", active)
       VALUES ($1,$2,$3,$4,$5,'SECRETARIA_REPRESENTANTE',$6,$7,true)`,
      [id, `Carga Secretaria ${i}`, email, `carga-sec-${i}`, randomUUID(), row.org, row.unit],
    );
    usuarios.push({ id, email, role: 'SECRETARIA_REPRESENTANTE', org: row.org, unit: row.unit });
  }

  // Alguns SEPLAN acompanhando os painéis durante o pico.
  for (let i = 0; i < 4; i += 1) {
    const id = `carga_seplan_${i}`;
    const email = `carga-seplan-${i}@${TEST_EMAIL_DOMAIN}`;
    await c.query(
      `INSERT INTO "User" (id, name, email, username, password, role, active)
       VALUES ($1,$2,$3,$4,$5,'SEPLAN_ADMIN',true)`,
      [id, `Carga SEPLAN ${i}`, email, `carga-seplan-${i}`, randomUUID()],
    );
    usuarios.push({ id, email, role: 'SEPLAN_ADMIN', org: null, unit: null });
  }

  // Sessão pré-aberta: o teste nunca passa pelo login, então não toca no
  // rate limit nem no advisory lock por conta.
  for (const u of usuarios) {
    u.token = `${TOKEN_PREFIX}${randomUUID()}`;
    await c.query('INSERT INTO "Session" (token, "userId") VALUES ($1,$2)', [u.token, u.id]);
  }

  // Validações que cada representante realmente controla, no exercício corrente
  // e ainda abertas para edição — o alvo legítimo de PATCH draft / POST submit.
  for (const u of usuarios) {
    if (u.role !== 'SECRETARIA_REPRESENTANTE') {
      u.validations = [];
      continue;
    }
    const r = await c.query(
      `SELECT v.id
         FROM "ActionValidation" v
         JOIN "BudgetAction" a ON a.id = v."actionId"
         JOIN "ExerciseUnitExecutor" e
           ON e.year = $1
          AND e."organizationCode" = v."organizationCode"
          AND e."unitCode" = v."unitCode"
        WHERE a.year = $1
          AND a."presentInCurrentQdd" = true
          AND e."executorOrgCode" = $2
          AND (e."executorUnitCode" = $3 OR ($3 IS NULL AND e."executorUnitCode" IS NULL))
          AND v.status IN ('RASCUNHO','DEVOLVIDO')`,
      [year, u.org, u.unit],
    );
    u.validations = r.rows.map((x) => x.id);
  }

  const comTrabalho = usuarios.filter((u) => u.validations.length > 0);
  const totalValidacoes = usuarios.reduce((s, u) => s + u.validations.length, 0);

  await writeFile(
    TARGETS_FILE,
    JSON.stringify({ year, geradoEm: new Date().toISOString(), usuarios }, null, 2),
  );

  console.log(`\nUsuários de teste criados: ${usuarios.length}`);
  console.log(`  representantes com validações abertas: ${comTrabalho.length}`);
  console.log(`  validações editáveis no total:        ${totalValidacoes}`);
  console.log(`\nEscritos: targets.json e baseline.json`);
  if (!comTrabalho.length) {
    console.log(
      '\n  AVISO: nenhuma validação em RASCUNHO/DEVOLVIDO. O cenário de escrita não terá\n' +
        '  o que exercitar — rode de novo com --deadline para reabrir as validações.',
    );
  } else {
    // Acima deste número os usuários virtuais passam a compartilhar conta e linha,
    // e o que se mede vira disputa de lock de linha, não capacidade da aplicação.
    console.log(
      `\n  Teto honesto de usuários virtuais distintos: ${comTrabalho.length} secretarias.\n` +
        '  Rampas acima disso reaproveitam contas — o número ainda vale para saturar o\n' +
        '  servidor, mas deixa de representar "N secretarias diferentes".',
    );
  }
}

const modo = process.argv[2];

// Antes de conectar: o baseline guarda o estado ORIGINAL do branch. Um segundo
// preparo o sobrescreveria com o estado já mutado (pós --deadline, pós carga), e
// o --reset passaria a restaurar lixo, com os APROVADO originais perdidos em
// silêncio. Barrar aqui também faz a checagem falhar de imediato, sem rede.
if (modo !== '--reset' && modo !== '--clean' && existsSync(BASELINE_FILE)) {
  abortar(
    'baseline.json já existe e guarda o estado ORIGINAL deste branch.\n' +
      '  Rode --reset antes de preparar de novo.\n' +
      '  Se o branch for novo, apague o arquivo primeiro.',
  );
}

const url = conexaoDeTeste();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  if (modo === '--clean') await limpar(c);
  else if (modo === '--reset') await restaurar(c);
  else await preparar(c);
} finally {
  await c.end();
}
