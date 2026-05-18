import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapAssignment } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (user.role === 'SECRETARIA_REPRESENTANTE' && !user.organizationCode) return ok([]);

  const rows = await prisma.thematicAssignment.findMany({
    where: user.role === 'SECRETARIA_REPRESENTANTE'
      ? {
          action: {
            organizationCode: user.organizationCode!,
            ...(user.unitCode && { unitCode: user.unitCode }),
          },
        }
      : undefined,
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
    select: { organizationCode: true, unitCode: true },
  });
  if (!action) return badRequest('Ação orçamentária não encontrada.');
  if (user.role === 'SECRETARIA_REPRESENTANTE') {
    if (!user.organizationCode || action.organizationCode !== user.organizationCode) return forbidden();
    if (user.unitCode && action.unitCode !== user.unitCode) return forbidden();
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

  const row = await prisma.thematicAssignment.create({
    data: {
      actionId: body.actionId,
      theme: body.theme,
      axis: body.axis,
      classification: body.classification,
      weightingFactor: body.weightingFactor ?? null,
      justification: body.justification ?? null,
      status: body.status ?? 'PRONTO_PARA_VALIDACAO',
      createdBy: user.id,
    },
  });
  return ok(mapAssignment(row));
}
