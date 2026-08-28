import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const existing = await prisma.actionValidation.findFirst({
    where: { id, action: { presentInCurrentQdd: true } },
    select: { id: true },
  });
  if (!existing) return notFound('Validação ativa não encontrada.');
  const row = await prisma.actionValidation.update({
    where: { id },
    data: { status: 'ENVIADO', reviewedAt: null, reviewerComment: null },
  }).catch(() => null);

  if (!row) return notFound('Validação não encontrada.');
  await logUserActivity({
    userId: user.id,
    action: 'VALIDATION_REVERT',
    entityType: 'ActionValidation',
    entityId: row.id,
    organizationCode: row.organizationCode,
    unitCode: row.unitCode,
  });
  return ok(row);
}
