import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REPRESENTANTE') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const row = await prisma.actionValidation.update({
    where: { id },
    data: {
      ...(body.executionStatus !== undefined && { executionStatus: body.executionStatus }),
      ...(body.realizedDescription !== undefined && { realizedDescription: body.realizedDescription }),
      ...(body.informedExecutedValue !== undefined && { informedExecutedValue: body.informedExecutedValue }),
      ...(body.observations !== undefined && { observations: body.observations }),
      ...(body.deliveries !== undefined && { deliveries: body.deliveries }),
      ...(body.evidences !== undefined && { evidences: body.evidences }),
    },
  }).catch(() => null);

  if (!row) return notFound('Validação não encontrada.');
  return ok(row);
}
