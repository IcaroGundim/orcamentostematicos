// Backup versionável da curadoria temática.
//
// Gera, em backups/<AAAA-MM-DD>/, uma cópia restaurável das tabelas críticas:
//   - curadoria.json  : dump bruto de ThematicAssignment, ActionValidation,
//                       ValidationCycle e metadados de BudgetImport.
//   - marcacoes.json  : marcações denormalizadas com as colunas da CHAVE LÓGICA
//   - marcacoes.csv     (year|org|unit|projectActivity|application) — formato
//   - marcacoes.xlsx    já validado para reconstrução via actionLogicalKey.
//
// Uso: DATABASE_URL="postgresql://..." node apps/web/scripts/backup.mjs
// Roda no CI (GitHub Actions) e localmente antes de qualquer mudança de risco.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import * as XLSX from 'xlsx';

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const webDir = path.resolve(scriptDir, '..');
config({ path: path.resolve(webDir, '.env.local'), quiet: true });
config({ path: path.resolve(webDir, '.env'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}

const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const stamp = new Date().toISOString().slice(0, 10); // AAAA-MM-DD (UTC)
const outDir = path.join(repoRoot, 'backups', stamp);
fs.mkdirSync(outDir, { recursive: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

// Serializa BigInt/Date de forma estável.
const jsonReplacer = (_k, v) => (typeof v === 'bigint' ? Number(v) : v);
const writeJson = (name, data) =>
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, jsonReplacer, 2));

async function optionalRaw(query, fallback = []) {
  try {
    return await prisma.$queryRawUnsafe(query);
  } catch (error) {
    // Permite que o backup obrigatório rode antes da fase 1 de uma expansão de
    // schema. Tabelas/colunas ainda inexistentes são simplesmente omitidas.
    console.warn(`[backup] consulta opcional indisponível: ${error.message}`);
    return fallback;
  }
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.join(';');
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}

(async () => {
  // 1) Dumps brutos (restauráveis 1:1).
  //
  // A estrutura por exercício entra aqui porque guarda curadoria MANUAL que não
  // existe em nenhum outro lugar: unidades realocadas, tipo de entidade,
  // ativo/inativo e os mapeamentos de executor. Com a retenção de ~6h do Neon,
  // ficar de fora do backup significaria perda irreversível.
  const [assignments, validations, cycles, imports, revisions, fiscalYears, exerciseOrgs, exerciseUnits, exerciseExecutors] =
    await Promise.all([
      prisma.$queryRawUnsafe('SELECT * FROM "ThematicAssignment"'),
      prisma.$queryRawUnsafe('SELECT * FROM "ActionValidation"'),
      prisma.$queryRawUnsafe('SELECT * FROM "ValidationCycle"'),
      prisma.$queryRawUnsafe(
        'SELECT id, filename, year, "referenceMonth", "periodType", status, "actionCount", "importedAt" FROM "BudgetImport"',
      ),
      optionalRaw('SELECT * FROM "BudgetImportRevision"'),
      prisma.$queryRawUnsafe('SELECT * FROM "FiscalYear"'),
      prisma.$queryRawUnsafe('SELECT * FROM "ExerciseOrganization"'),
      prisma.$queryRawUnsafe('SELECT * FROM "ExerciseUnit"'),
      prisma.$queryRawUnsafe('SELECT * FROM "ExerciseUnitExecutor"'),
    ]);

  writeJson('curadoria.json', {
    generatedAt: new Date().toISOString(),
    counts: {
      thematicAssignments: assignments.length,
      actionValidations: validations.length,
      validationCycles: cycles.length,
      budgetImports: imports.length,
      budgetImportRevisions: revisions.length,
      fiscalYears: fiscalYears.length,
      exerciseOrganizations: exerciseOrgs.length,
      exerciseUnits: exerciseUnits.length,
      exerciseUnitExecutors: exerciseExecutors.length,
    },
    thematicAssignments: assignments,
    actionValidations: validations,
    validationCycles: cycles,
    budgetImports: imports,
    budgetImportRevisions: revisions,
    fiscalYears,
    exerciseOrganizations: exerciseOrgs,
    exerciseUnits: exerciseUnits,
    exerciseUnitExecutors: exerciseExecutors,
  });

  // 2) Marcações denormalizadas (chave lógica) — o artefato de restore.
  let marcacoes = await optionalRaw(`
    SELECT ta.id, ta.theme, ta.axis, ta.classification, ta."weightingFactor",
           ta.justification, ta.status, ta."createdBy", ta."createdAt",
           ba.year, ba."organizationCode", ba."organizationName",
           ba."unitCode", ba."unitName", ba."projectActivity", ba.application,
           ba."presentInCurrentQdd", ba."inactiveAt",
           bi.status AS "importStatus"
    FROM "ThematicAssignment" ta
    JOIN "BudgetAction" ba ON ba.id = ta."actionId"
    JOIN "BudgetImport" bi ON bi.id = ba."importId"
    ORDER BY ta.theme, ba."organizationCode", ba."unitCode", ba."projectActivity"
  `);
  if (marcacoes.length === 0 && assignments.length > 0) {
    marcacoes = await prisma.$queryRawUnsafe(`
      SELECT ta.id, ta.theme, ta.axis, ta.classification, ta."weightingFactor",
             ta.justification, ta.status, ta."createdBy", ta."createdAt",
             ba.year, ba."organizationCode", ba."organizationName",
             ba."unitCode", ba."unitName", ba."projectActivity", ba.application,
             TRUE AS "presentInCurrentQdd", NULL::timestamp AS "inactiveAt",
             bi.status AS "importStatus"
      FROM "ThematicAssignment" ta
      JOIN "BudgetAction" ba ON ba.id = ta."actionId"
      JOIN "BudgetImport" bi ON bi.id = ba."importId"
      ORDER BY ta.theme, ba."organizationCode", ba."unitCode", ba."projectActivity"
    `);
  }

  const columns = [
    'theme', 'axis', 'classification', 'weightingFactor', 'justification', 'status',
    'year', 'organizationCode', 'organizationName', 'unitCode', 'unitName',
    'projectActivity', 'application', 'presentInCurrentQdd', 'inactiveAt',
    'importStatus', 'createdBy', 'createdAt', 'id',
  ];

  writeJson('marcacoes.json', marcacoes);
  fs.writeFileSync(path.join(outDir, 'marcacoes.csv'), toCsv(marcacoes, columns));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(marcacoes.map((r) => {
    const o = {};
    for (const c of columns) o[c] = r[c] ?? null;
    return o;
  }), { header: columns });
  XLSX.utils.book_append_sheet(wb, ws, 'Marcações');
  XLSX.writeFile(wb, path.join(outDir, 'marcacoes.xlsx'));

  const byTheme = {};
  for (const m of marcacoes) byTheme[m.theme] = (byTheme[m.theme] || 0) + 1;
  console.log(`[backup] ${outDir}`);
  console.log(`  marcações: ${marcacoes.length}`, JSON.stringify(byTheme));
  console.log(
    `  validações: ${validations.length} | ciclos: ${cycles.length} | ` +
      `imports: ${imports.length} | revisões: ${revisions.length}`,
  );
  console.log(
    `  estrutura por exercício: ${exerciseOrgs.length} órgãos | ${exerciseUnits.length} unidades | ` +
      `${exerciseExecutors.length} executores | ${fiscalYears.length} políticas de exercício`,
  );

  await prisma.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
