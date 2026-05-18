import { NextRequest } from 'next/server';
import { ValidationStatus } from '@prisma/client';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

const VALIDATION_STATUSES = ['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'] as const;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const rows = await prisma.validationCycle.findMany({
    orderBy: { openedAt: 'desc' },
    include: { validations: { select: { status: true } } },
  });
  return ok(rows.map((row) => ({
    ...mapCycle(row),
    validationCount: row.validations.length,
    validationsByStatus: VALIDATION_STATUSES.map((status) => ({
      status,
      count: row.validations.filter((v) => v.status === status).length,
    })),
  })));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.year || !body?.theme) return badRequest('name, year e theme são obrigatórios.');

  const cycle = await prisma.validationCycle.create({
    data: { name: body.name, year: Number(body.year), theme: body.theme, status: 'ABERTO' },
  });

  const assignments = await prisma.thematicAssignment.findMany({
    where: { theme: body.theme, status: 'PRONTO_PARA_VALIDACAO' },
    orderBy: { createdAt: 'asc' },
  });
  const uniqueAssignments = [...new Map(assignments.map((assignment) => [assignment.actionId, assignment])).values()];
  const actionIds = uniqueAssignments.map((a) => a.actionId);
  const actions = await prisma.budgetAction.findMany({ where: { id: { in: actionIds }, year: Number(body.year) } });
  const actionSet = new Set(actions.map((a) => a.id));
  const actionsById = new Map(actions.map((action) => [action.id, action]));

  const validationRows = uniqueAssignments
    .filter((a) => actionSet.has(a.actionId))
    .map((a) => {
      const action = actionsById.get(a.actionId)!;
      return {
        cycleId: cycle.id, actionId: a.actionId, assignmentId: a.id,
        organizationCode: action.organizationCode, unitCode: action.unitCode,
        theme: body.theme, status: ValidationStatus.RASCUNHO, deliveries: [], evidences: [],
      };
    });

  if (!validationRows.length) {
    await prisma.validationCycle.delete({ where: { id: cycle.id } });
    return badRequest('Nenhuma ação classificada foi encontrada para este tema e exercício.');
  }

  await prisma.actionValidation.createMany({
    data: validationRows,
    skipDuplicates: true,
  });

  const created = await prisma.validationCycle.findUniqueOrThrow({
    where: { id: cycle.id },
    include: { validations: { select: { status: true } } },
  });
  return ok({
    ...mapCycle(created),
    validationCount: created.validations.length,
    validationsByStatus: VALIDATION_STATUSES.map((status) => ({
      status,
      count: created.validations.filter((v) => v.status === status).length,
    })),
  });
}
