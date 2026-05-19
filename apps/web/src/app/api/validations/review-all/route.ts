import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REVISOR' || !user.organizationCode) return forbidden();

  const body = await req.json().catch(() => null);
  const approve = !!body?.approve;
  const comment = body?.reviewerComment ?? '';

  if (!approve && !comment.trim()) {
    return ok({ error: 'O comentário de devolução é obrigatório.' });
  }

  const validations = await prisma.actionValidation.findMany({
    where: {
      organizationCode: user.organizationCode,
      status: 'ENVIADO_REVISOR',
    },
  });

  if (!validations.length) {
    return ok({ revisados: 0 });
  }

  const ids = validations.map((v) => v.id);

  if (approve) {
    await prisma.actionValidation.updateMany({
      where: { id: { in: ids } },
      data: { status: 'APROVADO_REVISOR', reviewedAt: new Date() },
    });
  } else {
    // For return, we also set internalReviewerComment
    await prisma.actionValidation.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'DEVOLVIDO_REVISOR',
        internalReviewerComment: comment,
        reviewedAt: new Date(),
      },
    });
  }

  return ok({ revisados: ids.length });
}
