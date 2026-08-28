import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { prisma } from '@/lib/prisma';
import { mapAssignment } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;
  if (exercise.year == null) return ok([]);

  const rows = await prisma.budgetAction.findMany({
    where: { year: exercise.year, presentInCurrentQdd: false },
    include: {
      assignments: { orderBy: { createdAt: 'asc' } },
      validations: {
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          theme: true,
          status: true,
          deliveries: true,
          realizedDescription: true,
          informedExecutedValue: true,
          observations: true,
          reviewerComment: true,
        },
      },
      _count: { select: { expenseLines: true } },
      import: { select: { importedAt: true } },
    },
    orderBy: [
      { organizationCode: 'asc' },
      { unitCode: 'asc' },
      { projectActivity: 'asc' },
    ],
  });

  return ok(rows.map((row) => ({
    id: row.id,
    year: row.year,
    organizationCode: row.organizationCode,
    organizationName: row.organizationName,
    unitCode: row.unitCode,
    unitName: row.unitName,
    application: row.application,
    functionalProgram: row.functionalProgram,
    projectActivity: row.projectActivity,
    presentInCurrentQdd: false as const,
    inactiveAt: (row.inactiveAt ?? row.import.importedAt).toISOString(),
    totals: {
      initialBudget: row.initialBudget,
      supplemented: row.supplemented,
      updatedBudget: row.updatedBudget,
      committed: row.committed,
      liquidated: row.liquidated,
      paid: row.paid,
      available: row.available,
    },
    expenseLinesCount: row._count.expenseLines,
    assignments: row.assignments.map(mapAssignment),
    validations: row.validations.map((validation) => ({
      ...validation,
      deliveries: Array.isArray(validation.deliveries) ? validation.deliveries : [],
      realizedDescription: validation.realizedDescription ?? undefined,
      informedExecutedValue: validation.informedExecutedValue ?? undefined,
      observations: validation.observations ?? undefined,
      reviewerComment: validation.reviewerComment ?? undefined,
    })),
  })));
}
