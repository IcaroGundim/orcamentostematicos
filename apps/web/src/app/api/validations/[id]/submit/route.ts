import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { getCurrentYear, userControlsUnit } from '@/lib/store';
import { logUserActivity } from '@/lib/user-activity';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REPRESENTANTE') return forbidden();

  const { id } = await params;
  const existing = await prisma.actionValidation.findUnique({
    where: { id },
    select: {
      organizationCode: true,
      unitCode: true,
      action: { select: { year: true, presentInCurrentQdd: true } },
    },
  });
  if (!existing) return notFound('Validação não encontrada.');
  if (!existing.action.presentInCurrentQdd) return notFound('Validação ativa não encontrada.');
  const [currentYear, controlsUnit] = await Promise.all([
    getCurrentYear(),
    userControlsUnit(user, existing.organizationCode, existing.unitCode, existing.action.year),
  ]);
  if (existing.action.year !== currentYear) return forbidden();
  if (!controlsUnit) return forbidden();

  const row = await prisma.actionValidation.update({
    where: { id },
    data: { status: 'ENVIADO', submittedAt: new Date() },
  }).catch(() => null);

  if (!row) return notFound('Validação não encontrada.');
  await logUserActivity({
    userId: user.id,
    action: 'VALIDATION_SUBMIT',
    entityType: 'ActionValidation',
    entityId: row.id,
    organizationCode: row.organizationCode,
    unitCode: row.unitCode,
    metadata: { status: row.status },
  });
  return ok(row);
}
