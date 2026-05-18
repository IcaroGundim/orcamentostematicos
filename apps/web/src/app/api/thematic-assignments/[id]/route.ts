import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, conflict } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapAssignment } from '@/lib/store';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const row = await prisma.thematicAssignment.update({
    where: { id },
    data: {
      ...(body.axis !== undefined && { axis: body.axis }),
      ...(body.classification !== undefined && { classification: body.classification }),
      ...(body.weightingFactor !== undefined && { weightingFactor: body.weightingFactor }),
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

  const validationCount = await prisma.actionValidation.count({
    where: { assignmentId: id },
  });

  if (validationCount > 0) {
    return conflict(
      `Não é possível remover esta classificação: ${validationCount} validação${validationCount !== 1 ? 'ões' : ''} de execução ${validationCount !== 1 ? 'estão' : 'está'} vinculada${validationCount !== 1 ? 's' : ''} a ela.`,
    );
  }

  await prisma.thematicAssignment.delete({ where: { id } });
  return ok({ success: true });
}
