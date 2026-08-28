import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.actionValidation.findFirst({
    where: { id, action: { presentInCurrentQdd: true } },
    select: { id: true },
  });
  if (!existing) return notFound('Validação ativa não encontrada.');
  const row = await prisma.actionValidation.update({
    where: { id },
    data: { status: 'APROVADO', reviewedAt: new Date(), reviewerComment: body.reviewerComment ?? null },
  }).catch(() => null);

  if (!row) return notFound('Validação não encontrada.');
  await logUserActivity({
    userId: user.id,
    action: 'VALIDATION_APPROVE',
    entityType: 'ActionValidation',
    entityId: row.id,
    organizationCode: row.organizationCode,
    unitCode: row.unitCode,
  });
  return ok(row);
}
