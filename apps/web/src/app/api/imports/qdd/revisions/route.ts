import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;
  if (exercise.year == null) return ok([]);

  const rows = await prisma.budgetImportRevision.findMany({
    where: { year: exercise.year },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return ok(rows.map((row) => ({
    id: row.id,
    importId: row.importId,
    year: row.year,
    filename: row.filename,
    referenceMonth: row.referenceMonth,
    periodType: row.periodType,
    rowCount: row.rowCount,
    actionCount: row.actionCount,
    source: row.source,
    updatedBy: row.updatedBy,
    updatedByName: row.user?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  })));
}
