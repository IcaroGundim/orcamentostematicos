import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { resolveWeightingFactor } from '@/lib/classification-rules';
import { prisma } from '@/lib/prisma';
import {
  mapAssignment,
  getCurrentYear,
  getOrCreateImplicitCycle,
  getVigenteImportId,
  isComparisonOnlyYear,
  scopeWhere,
  userControlsUnit,
} from '@/lib/store';
import { resolveRequestYear } from '@/lib/exercise-request';
import { logUserActivity } from '@/lib/user-activity';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;
  const year = exercise.year;

  const actionScope = await scopeWhere(user, year);
  // Mesmo a SEPLAN passa a receber apenas o exercício selecionado: antes o `where`
  // ficava `undefined` e devolvia as marcações de todos os anos de uma vez.
  const yearScope = year == null ? {} : { year };
  const rows = await prisma.thematicAssignment.findMany({
    where: {
      action: user.role === 'SEPLAN_ADMIN' ? yearScope : { ...actionScope, ...yearScope },
    },
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
    select: { organizationCode: true, unitCode: true, year: true, importId: true },
  });
  if (!action) return badRequest('Ação orçamentária não encontrada.');

  // A ação precisa pertencer ao QDD vigente do seu exercício. Sem esta amarração,
  // um id de ação de importação histórica seria aceito e a marcação nasceria presa
  // a dados aposentados.
  const vigenteImportId = await getVigenteImportId(action.year);
  if (!vigenteImportId || action.importId !== vigenteImportId) {
    return badRequest('Esta ação não pertence ao QDD vigente do exercício.');
  }

  const comparisonOnly = await isComparisonOnlyYear(action.year);

  if (user.role === 'SECRETARIA_REPRESENTANTE') {
    // Secretaria só atua no exercício corrente: exercícios comparativos são
    // exclusivos da SEPLAN e não têm entregas a preencher.
    const currentYear = await getCurrentYear();
    if (comparisonOnly || action.year !== currentYear) return forbidden();
    const allowed = await userControlsUnit(user, action.organizationCode, action.unitCode, action.year);
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
  // Exercício apenas comparativo não gera ciclo nem entrega: ele recebe execução e
  // marcações temáticas e para por aí.
  const cycle = comparisonOnly ? null : await getOrCreateImplicitCycle(body.theme, action.year);

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
    const alreadyExists = cycle
      ? await tx.actionValidation.findFirst({
          where: { assignmentId: assignment.id },
          select: { id: true },
        })
      : null;
    if (cycle && !alreadyExists) {
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
