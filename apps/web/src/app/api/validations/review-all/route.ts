import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { scopeWhere } from '@/lib/store';
import { logUserActivity } from '@/lib/user-activity';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REVISOR') return forbidden();
  if (!user.organizationCode) return forbidden();

  const body = await req.json().catch(() => null);
  const approve = !!body?.approve;
  const comment = body?.reviewerComment ?? '';

  if (!approve && !comment.trim()) {
    return ok({ error: 'O comentário de devolução é obrigatório.' });
  }

  const scope = await scopeWhere(user);
  const validations = await prisma.actionValidation.findMany({
    where: {
      ...scope,
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

  await logUserActivity({
    userId: user.id,
    action: 'VALIDATION_BULK_REVIEW',
    organizationCode: user.organizationCode,
    metadata: { count: ids.length, approve },
  });

  return ok({ revisados: ids.length });
}
