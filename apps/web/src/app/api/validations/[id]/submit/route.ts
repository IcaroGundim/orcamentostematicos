import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REPRESENTANTE') return forbidden();

  const { id } = await params;
  const row = await prisma.actionValidation.update({
    where: { id },
    data: { status: 'ENVIADO', submittedAt: new Date() },
  }).catch(() => null);

  if (!row) return notFound('Validação não encontrada.');
  return ok(row);
}
