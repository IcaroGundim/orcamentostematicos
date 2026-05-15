import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { QddPeriodType } from '../src/common/domain';
import { parseQdd } from '../src/imports/qdd-parser';

const qddPath = resolve(process.cwd(), '../../QDD_Saldo_Retroativo_Execucao-1425-20260513.xls');
const outputPath = resolve(process.cwd(), 'src/seeds/qdd-vigente.seed.ts');

const counters = new Map<string, number>();
const createSeedId = (prefix: string) => {
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);
  return `seed-${prefix}-${next}`;
};

const periodInfo = { periodType: QddPeriodType.AcumuladoAnual, referenceMonth: 4 };
const parsed = parseQdd(basename(qddPath), readFileSync(qddPath), createSeedId, periodInfo);

const generated = `import type { BudgetAction, BudgetImport } from '../common/domain';

export const qddVigenteImport = ${JSON.stringify(parsed.importRecord, null, 2)} satisfies BudgetImport;

export const qddVigenteActions = ${JSON.stringify(parsed.actions, null, 2)} satisfies BudgetAction[];
`;

mkdirSync(resolve(outputPath, '..'), { recursive: true });
writeFileSync(outputPath, generated);

console.log(`Seed gerada em ${outputPath}`);
console.log(`${parsed.importRecord.rowCount} linhas, ${parsed.importRecord.actionCount} ações, ${parsed.organizationsCount} órgãos, ${parsed.unitsCount} unidades.`);
