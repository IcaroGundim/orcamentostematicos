import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, notFound, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/execution/unit-executor
 *
 * Body: { organizationCode, unitCode, executorUnitCode | null }
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

  const target = await prisma.governmentUnit.findUnique({
    where: { organizationCode_code: { organizationCode, code: unitCode } },
    select: { code: true },
  });
  if (!target) return notFound('Unidade não encontrada no cadastro de estrutura.');

  if (executorUnitCode) {
    const executor = await prisma.governmentUnit.findUnique({
      where: {
        organizationCode_code: { organizationCode, code: executorUnitCode },
      },
      select: { code: true },
    });
    if (!executor) {
      return badRequest('A unidade executora precisa pertencer à mesma secretaria no cadastro.');
    }
  }

  const row = await prisma.unitExecutor.upsert({
    where: { organizationCode_unitCode: { organizationCode, unitCode } },
    update: { executorOrgCode: organizationCode, executorUnitCode },
    create: { organizationCode, unitCode, executorOrgCode: organizationCode, executorUnitCode },
  });

  return ok(row);
}
