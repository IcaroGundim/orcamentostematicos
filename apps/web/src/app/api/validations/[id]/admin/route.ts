import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { resolveInformedExecutedValue } from '@/lib/classification-rules';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.actionValidation.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!existing) return notFound('Validação não encontrada.');

  const deliveries = body.deliveries !== undefined ? body.deliveries : existing.deliveries;
  const classification = existing.assignment?.classification ?? '';
  const informedExecutedValue =
    body.informedExecutedValue !== undefined || body.deliveries !== undefined
      ? resolveInformedExecutedValue({
          theme: existing.theme,
          classification,
          deliveries: Array.isArray(deliveries) ? deliveries : [],
          informedExecutedValue: body.informedExecutedValue ?? existing.informedExecutedValue,
        })
      : undefined;

  const row = await prisma.actionValidation
    .update({
      where: { id },
      data: {
        ...(body.executionStatus !== undefined && { executionStatus: body.executionStatus }),
        ...(body.realizedDescription !== undefined && { realizedDescription: body.realizedDescription }),
        ...(informedExecutedValue !== undefined && { informedExecutedValue }),
        ...(body.observations !== undefined && { observations: body.observations }),
        ...(body.deliveries !== undefined && { deliveries: body.deliveries }),
        ...(body.evidences !== undefined && { evidences: body.evidences }),
      },
    })
    .catch(() => null);

  if (!row) return notFound('Validação não encontrada.');

  await logUserActivity({
    userId: user.id,
    action: 'VALIDATION_ADMIN_DRAFT',
    entityType: 'ActionValidation',
    entityId: row.id,
    organizationCode: row.organizationCode,
    unitCode: row.unitCode,
  });

  return ok(row);
}
