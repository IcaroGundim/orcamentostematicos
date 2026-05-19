import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REVISOR') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body?.internalReviewerComment) return badRequest('internalReviewerComment é obrigatório.');

  const validation = await prisma.actionValidation.findUnique({
    where: { id },
  });

  if (!validation) return notFound('Validação não encontrada.');
  if (validation.organizationCode !== user.organizationCode) return forbidden();

  const row = await prisma.actionValidation.update({
    where: { id },
    data: {
      status: 'DEVOLVIDO_REVISOR',
      reviewedAt: new Date(),
      internalReviewerComment: body.internalReviewerComment,
    },
  }).catch(() => null);

  if (!row) return notFound('Não foi possível devolver a validação.');
  return ok(row);
}
