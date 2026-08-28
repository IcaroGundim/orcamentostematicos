// Consolida o legado de múltiplas BudgetImport em uma base por exercício.
//
// Pré-requisito: aplicar a fase 1 do schema (BudgetAction.presentInCurrentQdd,
// inactiveAt e BudgetImportRevision), ainda SEM o índice único de BudgetImport.year.
// O modo padrão é somente leitura; --apply faz backup antes de qualquer escrita.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
config({ path: path.resolve(webDir, '.env.local'), quiet: true });
config({ path: path.resolve(webDir, '.env'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function actionKey(action) {
  return [
    action.year,
    action.organizationCode,
    action.unitCode,
    action.projectActivity,
    normalize(action.application),
  ].join('|');
}

function chooseBase(imports) {
  return [...imports].sort((a, b) => {
    const status = Number(b.status === 'VIGENTE') - Number(a.status === 'VIGENTE');
    return status || b.importedAt.getTime() - a.importedAt.getTime();
  })[0];
}

function inspectYear(year, imports) {
  const base = chooseBase(imports);
  const assignmentsByKeyTheme = new Map();
  let linkedHistoricalActions = 0;
  let inactiveActions = 0;

  for (const item of imports) {
    for (const action of item.actions) {
      const key = actionKey(action);
      if (item.id !== base.id && (action._count.assignments > 0 || action._count.validations > 0)) {
        linkedHistoricalActions += 1;
      }
      for (const assignment of action.assignments) {
        const markerKey = `${key}|${assignment.theme}`;
        const list = assignmentsByKeyTheme.get(markerKey) ?? [];
        list.push({ assignmentId: assignment.id, actionId: action.id });
        assignmentsByKeyTheme.set(markerKey, list);
      }
    }
  }

  const baseKeys = new Set(base.actions.map(actionKey));
  const preservedMissingKeys = new Set();
  for (const item of imports) {
    if (item.id === base.id) continue;
    for (const action of item.actions) {
      if (
        (action._count.assignments > 0 || action._count.validations > 0) &&
        !baseKeys.has(actionKey(action))
      ) {
        preservedMissingKeys.add(actionKey(action));
      }
    }
  }
  inactiveActions = preservedMissingKeys.size;

  const conflicts = [...assignmentsByKeyTheme]
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => ({ key, records }));

  return {
    year,
    baseId: base.id,
    baseFilename: base.filename,
    imports: imports.length,
    revisionsToCreate: imports.length,
    linkedHistoricalActions,
    inactiveActions,
    conflicts,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function loadImports() {
  return prisma.budgetImport.findMany({
    include: {
      actions: {
        include: {
          assignments: { select: { id: true, theme: true } },
          _count: { select: { assignments: true, validations: true } },
        },
      },
    },
    orderBy: [{ year: 'asc' }, { importedAt: 'desc' }],
  });
}

async function consolidateYear(year, importIds) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)::text AS lock_result',
      20260828,
      year,
    );

    const imports = await tx.budgetImport.findMany({
      where: { id: { in: importIds } },
      include: {
        actions: {
          include: {
            assignments: { select: { id: true, theme: true } },
            _count: { select: { assignments: true, validations: true } },
          },
        },
      },
    });
    if (imports.length === 0) return;

    const report = inspectYear(year, imports);
    if (report.conflicts.length > 0) {
      throw new Error(`Exercício ${year} possui marcações duplicadas; consolidação abortada.`);
    }

    const base = imports.find((item) => item.id === report.baseId);
    const baseByKey = new Map(base.actions.map((action) => [actionKey(action), action]));

    for (const oldImport of imports) {
      await tx.budgetImportRevision.upsert({
        where: { legacyImportId: oldImport.id },
        create: {
          importId: base.id,
          legacyImportId: oldImport.id,
          year: oldImport.year,
          filename: oldImport.filename,
          referenceMonth: oldImport.referenceMonth,
          periodType: oldImport.periodType,
          rowCount: oldImport.rowCount,
          actionCount: oldImport.actionCount,
          source: 'MIGRATED',
          createdAt: oldImport.importedAt,
        },
        update: { importId: base.id },
      });
    }

    for (const oldImport of imports) {
      if (oldImport.id === base.id) continue;
      for (const oldAction of oldImport.actions) {
        if (oldAction._count.assignments === 0 && oldAction._count.validations === 0) continue;

        const key = actionKey(oldAction);
        const target = baseByKey.get(key);
        if (target) {
          await tx.thematicAssignment.updateMany({
            where: { actionId: oldAction.id },
            data: { actionId: target.id },
          });
          await tx.actionValidation.updateMany({
            where: { actionId: oldAction.id },
            data: { actionId: target.id },
          });
        } else {
          await tx.budgetAction.update({
            where: { id: oldAction.id },
            data: {
              importId: base.id,
              presentInCurrentQdd: false,
              inactiveAt: base.importedAt,
            },
          });
          baseByKey.set(key, oldAction);
        }
      }
    }

    await tx.budgetImport.deleteMany({
      where: { year, id: { not: base.id } },
    });
    await tx.budgetAction.updateMany({
      where: { importId: base.id, inactiveAt: null },
      data: { presentInCurrentQdd: true },
    });
    const activeCount = await tx.budgetAction.count({
      where: { importId: base.id, presentInCurrentQdd: true },
    });
    await tx.budgetImport.update({
      where: { id: base.id },
      data: { status: 'VIGENTE', actionCount: activeCount },
    });
  }, { maxWait: 10000, timeout: 120000 });
}

try {
  const imports = await loadImports();
  const byYear = new Map();
  for (const item of imports) {
    const list = byYear.get(item.year) ?? [];
    list.push(item);
    byYear.set(item.year, list);
  }

  const reports = [...byYear].map(([year, rows]) => inspectYear(year, rows));
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', exercises: reports }, null, 2));

  const conflicts = reports.flatMap((report) =>
    report.conflicts.map((conflict) => ({ year: report.year, ...conflict })),
  );
  if (conflicts.length > 0) {
    console.error('Conflitos encontrados. Nenhuma alteração foi aplicada.');
    process.exitCode = 2;
  } else if (APPLY) {
    const backup = spawnSync(process.execPath, [path.join(scriptDir, 'backup.mjs')], {
      cwd: path.resolve(scriptDir, '..'),
      env: process.env,
      stdio: 'inherit',
    });
    if (backup.status !== 0) throw new Error('Backup obrigatório falhou.');

    for (const [year, rows] of byYear) {
      await consolidateYear(year, rows.map((row) => row.id));
      console.log(`[consolidate] exercício ${year}: concluído`);
    }

    const duplicates = await prisma.$queryRawUnsafe(`
      SELECT "year", COUNT(*)::int AS count
      FROM "BudgetImport"
      GROUP BY "year"
      HAVING COUNT(*) > 1
    `);
    if (duplicates.length > 0) throw new Error('Ainda existem exercícios com mais de uma importação.');
    console.log('[consolidate] verificação final concluída; o índice único já pode ser aplicado.');
  }
} finally {
  await prisma.$disconnect();
}
