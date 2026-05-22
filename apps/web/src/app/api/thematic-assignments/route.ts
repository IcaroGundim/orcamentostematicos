import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { resolveWeightingFactor } from '@/lib/classification-rules';
import { prisma } from '@/lib/prisma';
import { mapAssignment, getOrCreateImplicitCycle, scopeWhere, userControlsUnit } from '@/lib/store';
import { logUserActivity } from '@/lib/user-activity';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const actionScope = await scopeWhere(user);
  const rows = await prisma.thematicAssignment.findMany({
    where: user.role === 'SEPLAN_ADMIN' ? undefined : { action: actionScope },
    orderBy: { createdAt: 'asc' },
  });
  return ok(rows.map(mapAssignment));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN' && user.role !== 'SECRETARIA_REPRESENTANTE') return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.actionId || !body?.theme || !body?.axis || !body?.classification) {
    return badRequest('actionId, theme, axis e classification são obrigatórios.');
  }

  const action = await prisma.budgetAction.findUnique({
    where: { id: body.actionId },
    select: { organizationCode: true, unitCode: true, year: true },
  });
  if (!action) return badRequest('Ação orçamentária não encontrada.');
  if (user.role === 'SECRETARIA_REPRESENTANTE') {
    const allowed = await userControlsUnit(user, action.organizationCode, action.unitCode);
    if (!allowed) return forbidden();
  }

  const existing = await prisma.thematicAssignment.findFirst({
    where: {
      actionId: body.actionId,
      theme: body.theme,
    },
  });
  if (existing) {
    return badRequest('Esta ação já foi classificada para este orçamento temático.');
  }

  // Ciclo implícito do par tema/exercício — substitui a antiga "liberação" manual.
  const cycle = await getOrCreateImplicitCycle(body.theme, action.year);

  const row = await prisma.$transaction(async (tx) => {
    const assignment = await tx.thematicAssignment.create({
      data: {
        actionId: body.actionId,
        theme: body.theme,
        axis: body.axis,
        classification: body.classification,
        weightingFactor: resolveWeightingFactor(
          body.theme,
          body.classification,
          body.weightingFactor ?? null,
        ),
        justification: body.justification ?? null,
        status: body.status ?? 'PRONTO_PARA_VALIDACAO',
        createdBy: user.id,
      },
    });

    // A validação é gerada automaticamente: a secretaria já a vê na aba
    // Validações sem depender de a SEPLAN abrir um ciclo.
    const alreadyExists = await tx.actionValidation.findFirst({
      where: { assignmentId: assignment.id },
      select: { id: true },
    });
    if (!alreadyExists) {
      await tx.actionValidation.create({
        data: {
          cycleId: cycle.id,
          actionId: body.actionId,
          assignmentId: assignment.id,
          organizationCode: action.organizationCode,
          unitCode: action.unitCode,
          theme: body.theme,
          status: 'RASCUNHO',
          deliveries: [],
          evidences: [],
        },
      });
    }

    return assignment;
  });

  await logUserActivity({
    userId: user.id,
    action: 'ASSIGNMENT_CREATE',
    entityType: 'ThematicAssignment',
    entityId: row.id,
    organizationCode: action.organizationCode,
    unitCode: action.unitCode,
    metadata: { theme: row.theme, classification: row.classification },
  });

  return ok(mapAssignment(row));
}
