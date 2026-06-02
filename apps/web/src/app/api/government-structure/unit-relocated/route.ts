import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, notFound, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/government-structure/unit-relocated
 *
 * Marca/desmarca uma unidade como "realocada" (remanejada de secretaria).
 * Body: { organizationCode, unitCode, relocated: boolean }
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
  const relocated = Boolean(body?.relocated);

  const target = await prisma.governmentUnit.findUnique({
    where: { organizationCode_code: { organizationCode, code: unitCode } },
    select: { code: true },
  });
  if (!target) return notFound('Unidade não encontrada no cadastro de estrutura.');

  const row = await prisma.governmentUnit.update({
    where: { organizationCode_code: { organizationCode, code: unitCode } },
    data: { relocated },
  });

  return ok(row);
}
