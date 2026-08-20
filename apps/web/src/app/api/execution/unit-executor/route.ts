import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, notFound, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { resolveRequestYear } from '@/lib/exercise-request';

/**
 * PUT /api/execution/unit-executor
 *
 * Body: { organizationCode, unitCode, executorUnitCode | null }
 *
 * Opera no exercício informado em `?year=` (obrigatório): o mapeamento de executor
 * é por exercício — `getAllowedUnits` o consulta para qualquer ano ao montar o
 * escopo de leitura, inclusive de exercícios comparativos.
 */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  const organizationCode = String(body?.organizationCode ?? '').trim();
  const unitCode = String(body?.unitCode ?? '').trim();
  if (!organizationCode || !unitCode) {
    return badRequest('organizationCode e unitCode são obrigatórios.');
  }
  const executorUnitCode =
    body?.executorUnitCode == null || body?.executorUnitCode === ''
      ? null
      : String(body.executorUnitCode).trim();

  const exercise = await resolveRequestYear(req, user, { mode: 'strict' });
  if (exercise.response) return exercise.response;
  if (exercise.year == null) return badRequest('Nenhum exercício vigente.');
  const year = exercise.year;

  const target = await prisma.exerciseUnit.findUnique({
    where: { year_organizationCode_code: { year, organizationCode, code: unitCode } },
    select: { code: true },
  });
  if (!target) return notFound('Unidade não encontrada no cadastro de estrutura.');

  if (executorUnitCode) {
    const executor = await prisma.exerciseUnit.findUnique({
      where: {
        year_organizationCode_code: { year, organizationCode, code: executorUnitCode },
      },
      select: { code: true },
    });
    if (!executor) {
      return badRequest('A unidade executora precisa pertencer à mesma secretaria no cadastro.');
    }
  }

  const row = await prisma.exerciseUnitExecutor.upsert({
    where: { year_organizationCode_unitCode: { year, organizationCode, unitCode } },
    update: { executorOrgCode: organizationCode, executorUnitCode },
    create: { year, organizationCode, unitCode, executorOrgCode: organizationCode, executorUnitCode },
  });

  return ok(row);
}
