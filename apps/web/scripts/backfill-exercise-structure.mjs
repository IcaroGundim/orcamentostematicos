// Backfill da estrutura de governo POR EXERCÍCIO (expandir-contrair, passo 2).
//
// Copia GovernmentOrganization / GovernmentUnit / UnitExecutor — que não têm ano —
// para ExerciseOrganization / ExerciseUnit / ExerciseUnitExecutor, carimbando o
// exercício corrente. As tabelas antigas NÃO são tocadas: seguem no banco como
// rede de segurança até uma remoção deliberada.
//
// Idempotente: usa skipDuplicates, então rodar de novo não duplica nem sobrescreve
// ajustes já feitos na estrutura do exercício.
//
// Uso: DATABASE_URL="postgresql://..." node apps/web/scripts/backfill-exercise-structure.mjs [--ano=2026]

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('Defina DATABASE_URL.'); process.exit(1); }

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

const argAno = process.argv.slice(2).find((a) => a.startsWith('--ano='));

/** Exercício corrente: o ano do import VIGENTE mais recente. */
async function resolveYear() {
  if (argAno) return Number(argAno.split('=')[1]);
  const vigente = await prisma.budgetImport.findFirst({
    where: { status: 'VIGENTE' },
    orderBy: [{ year: 'desc' }, { importedAt: 'desc' }],
    select: { year: true },
  });
  if (!vigente) throw new Error('Nenhum BudgetImport VIGENTE — informe --ano=AAAA.');
  return vigente.year;
}

const year = await resolveYear();
console.log(`[backfill] exercício alvo: ${year}`);

const [orgs, units, executors] = await Promise.all([
  prisma.governmentOrganization.findMany(),
  prisma.governmentUnit.findMany(),
  prisma.unitExecutor.findMany(),
]);
console.log(`[origem] orgs=${orgs.length} unidades=${units.length} executores=${executors.length}`);

const curadoria = {
  realocadas: units.filter((u) => u.relocated).length,
  inativas: units.filter((u) => !u.active).length,
  executoresCustomizados: executors.filter(
    (e) => e.executorOrgCode !== e.organizationCode || e.executorUnitCode !== null,
  ).length,
};
console.log('[curadoria a preservar]', curadoria);

// Ordem importa: ExerciseUnit tem FK para ExerciseOrganization.
const r1 = await prisma.exerciseOrganization.createMany({
  data: orgs.map((o) => ({ year, code: o.code, name: o.name, type: o.type, active: o.active, createdAt: o.createdAt })),
  skipDuplicates: true,
});
const r2 = await prisma.exerciseUnit.createMany({
  data: units.map((u) => ({
    year, organizationCode: u.organizationCode, code: u.code, name: u.name,
    active: u.active, relocated: u.relocated, createdAt: u.createdAt,
  })),
  skipDuplicates: true,
});
const r3 = await prisma.exerciseUnitExecutor.createMany({
  data: executors.map((e) => ({
    year, organizationCode: e.organizationCode, unitCode: e.unitCode,
    executorOrgCode: e.executorOrgCode, executorUnitCode: e.executorUnitCode,
  })),
  skipDuplicates: true,
});
console.log(`[inseridos] orgs=${r1.count} unidades=${r2.count} executores=${r3.count}`);

// Conferência: o destino tem de espelhar a origem para este exercício.
const [dOrgs, dUnits, dRealoc, dExecRows] = await Promise.all([
  prisma.exerciseOrganization.count({ where: { year } }),
  prisma.exerciseUnit.count({ where: { year } }),
  prisma.exerciseUnit.count({ where: { year, relocated: true } }),
  prisma.exerciseUnitExecutor.findMany({ where: { year } }),
]);
const dCustom = dExecRows.filter(
  (e) => e.executorOrgCode !== e.organizationCode || e.executorUnitCode !== null,
).length;
console.log(`[destino ${year}] orgs=${dOrgs} unidades=${dUnits} executores=${dExecRows.length} realocadas=${dRealoc} executoresCustomizados=${dCustom}`);

const ok =
  dOrgs === orgs.length &&
  dUnits === units.length &&
  dExecRows.length === executors.length &&
  dRealoc === curadoria.realocadas &&
  dCustom === curadoria.executoresCustomizados;
console.log(ok ? '✔ contagens conferem' : '✖ DIVERGENCIA nas contagens — investigar antes de seguir');

await prisma.$disconnect();
process.exit(ok ? 0 : 1);
