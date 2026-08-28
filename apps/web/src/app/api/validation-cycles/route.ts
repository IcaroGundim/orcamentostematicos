import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

const VALIDATION_STATUSES = ['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'] as const;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  const rows = await prisma.validationCycle.findMany({
    where: exercise.year == null ? {} : { year: exercise.year },
    orderBy: { openedAt: 'desc' },
    include: {
      validations: {
        where: { action: { presentInCurrentQdd: true } },
        select: { status: true },
      },
    },
  });
  return ok(rows.map((row) => {
    const countByStatus = new Map<string, number>();
    for (const v of row.validations) {
      countByStatus.set(v.status, (countByStatus.get(v.status) ?? 0) + 1);
    }
    return {
      ...mapCycle(row),
      validationCount: row.validations.length,
      validationsByStatus: VALIDATION_STATUSES.map((status) => ({
        status,
        count: countByStatus.get(status) ?? 0,
      })),
    };
  }));
}

/**
 * Abertura manual de ciclo foi descontinuada: os ciclos agora são implícitos e
 * criados automaticamente na classificação temática. Mantido apenas para
 * recusar chamadas antigas explicitamente.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  return forbidden();
}
