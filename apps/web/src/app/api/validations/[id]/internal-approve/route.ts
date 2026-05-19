import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REVISOR') return forbidden();

  const { id } = await params;
  
  const validation = await prisma.actionValidation.findUnique({
    where: { id },
  });

  if (!validation) return notFound('Validação não encontrada.');
  if (validation.organizationCode !== user.organizationCode) return forbidden();

  const row = await prisma.actionValidation.update({
    where: { id },
    data: { status: 'ENVIADO', reviewedAt: new Date() },
  }).catch(() => null);

  if (!row) return notFound('Não foi possível aprovar a validação.');
  return ok(row);
}
