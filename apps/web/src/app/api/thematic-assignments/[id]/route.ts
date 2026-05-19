import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, conflict } from '@/lib/auth-server';
import { resolveWeightingFactor } from '@/lib/classification-rules';
import { prisma } from '@/lib/prisma';
import { mapAssignment, isEmptyDraftValidation } from '@/lib/store';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.thematicAssignment.findUnique({ where: { id } });
  if (!existing) return notFound('Atribuição temática não encontrada.');

  const theme = body.theme ?? existing.theme;
  const classification = body.classification ?? existing.classification;
  const weightingFactor =
    body.weightingFactor !== undefined || body.classification !== undefined
      ? resolveWeightingFactor(theme, classification, body.weightingFactor ?? existing.weightingFactor)
      : undefined;

  const row = await prisma.thematicAssignment.update({
    where: { id },
    data: {
      ...(body.axis !== undefined && { axis: body.axis }),
      ...(body.classification !== undefined && { classification: body.classification }),
      ...(weightingFactor !== undefined && { weightingFactor }),
      ...(body.justification !== undefined && { justification: body.justification }),
      ...(body.status && { status: body.status }),
    },
  }).catch(() => null);

  if (!row) return notFound('Atribuição temática não encontrada.');
  return ok(mapAssignment(row));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const row = await prisma.thematicAssignment.findUnique({
    where: { id },
    include: {
      action: { select: { organizationCode: true, unitCode: true } },
    },
  });

  if (!row) return notFound('Atribuição temática não encontrada.');

  if (user.role === 'SECRETARIA_REPRESENTANTE') {
    if (!user.organizationCode || row.action.organizationCode !== user.organizationCode) return forbidden();
    if (user.unitCode && row.action.unitCode !== user.unitCode) return forbidden();
  } else if (user.role !== 'SEPLAN_ADMIN') {
    return forbidden();
  }

  // Toda classificação agora nasce com uma validação RASCUNHO automática.
  // Só bloqueamos a remoção quando essa validação já recebeu dados da
  // secretaria; validações RASCUNHO vazias são apagadas junto.
  const validations = await prisma.actionValidation.findMany({
    where: { assignmentId: id },
  });

  const withData = validations.filter((v) => !isEmptyDraftValidation(v));
  if (withData.length > 0) {
    return conflict(
      'Não é possível remover esta classificação: ela possui validação de execução com dados preenchidos pela secretaria.',
    );
  }

  await prisma.$transaction([
    prisma.actionValidation.deleteMany({ where: { assignmentId: id } }),
    prisma.thematicAssignment.delete({ where: { id } }),
  ]);
  return ok({ success: true });
}
