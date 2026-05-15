import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const rows = await prisma.validationCycle.findMany({ orderBy: { openedAt: 'desc' } });
  return ok(rows.map(mapCycle));
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
  });
  const actionIds = assignments.map((a) => a.actionId);
  const actions = await prisma.budgetAction.findMany({ where: { id: { in: actionIds }, year: Number(body.year) } });
  const actionSet = new Set(actions.map((a) => a.id));

  await prisma.actionValidation.createMany({
    data: assignments
      .filter((a) => actionSet.has(a.actionId))
      .map((a) => {
        const action = actions.find((ac) => ac.id === a.actionId)!;
        return {
          cycleId: cycle.id, actionId: a.actionId, assignmentId: a.id,
          organizationCode: action.organizationCode, unitCode: action.unitCode,
          theme: body.theme, status: 'RASCUNHO', deliveries: [], evidences: [],
        };
      }),
    skipDuplicates: true,
  });

  return ok(mapCycle(cycle));
}
