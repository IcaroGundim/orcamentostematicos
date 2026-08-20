import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, notFound, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/government-structure/unit-relocated
 *
 * Marca/desmarca uma unidade como "realocada" (remanejada de secretaria).
 * Body: { organizationCode, unitCode, relocated: boolean }
 * Query: ?year= (opcional; por padrão o exercício corrente)
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

  const exercise = await resolveRequestYear(req, user, { mode: 'strict' });
  if (exercise.response) return exercise.response;
  if (exercise.year == null) return badRequest('Nenhum exercício vigente.');
  const year = exercise.year;

  const target = await prisma.exerciseUnit.findUnique({
    where: { year_organizationCode_code: { year, organizationCode, code: unitCode } },
    select: { code: true },
  });
  if (!target) return notFound('Unidade não encontrada no cadastro de estrutura.');

  const row = await prisma.exerciseUnit.update({
    where: { year_organizationCode_code: { year, organizationCode, code: unitCode } },
    data: { relocated },
  });

  return ok(row);
}
