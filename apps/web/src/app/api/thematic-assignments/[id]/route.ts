import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
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
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  await prisma.thematicAssignment.delete({ where: { id } }).catch(() => null);
  return ok({ success: true });
}
