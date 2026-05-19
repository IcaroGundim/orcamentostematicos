import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { validationFormSchema } from '@/lib/validation-schema';

/**
 * Envio consolidado: a secretaria envia de uma vez todas as suas validações
 * em RASCUNHO/DEVOLVIDO que estejam completas. As incompletas são puladas.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REPRESENTANTE' || !user.organizationCode) return forbidden();

  const body = await req.json().catch(() => null);
  const toSeplan = !!body?.toSeplan;

  const targetStatuses = toSeplan ? ['APROVADO_REVISOR'] : ['RASCUNHO', 'DEVOLVIDO', 'DEVOLVIDO_REVISOR'];

  const rows = await prisma.actionValidation.findMany({
    where: {
      organizationCode: user.organizationCode,
      ...(user.unitCode ? { unitCode: user.unitCode } : {}),
      status: { in: targetStatuses as any },
    },
  });

  const completeIds: string[] = [];
  let incompletas = 0;

  for (const row of rows) {
    const parsed = validationFormSchema.safeParse({
      executionStatus: row.executionStatus ?? '',
      realizedDescription: row.realizedDescription ?? '',
      informedExecutedValue: row.informedExecutedValue ?? 0,
      observations: row.observations ?? undefined,
      deliveries: Array.isArray(row.deliveries) ? row.deliveries : [],
    });
    if (parsed.success) {
      completeIds.push(row.id);
    } else {
      incompletas += 1;
    }
  }

  if (completeIds.length) {
    const nextStatus = toSeplan ? 'ENVIADO' : 'ENVIADO_REVISOR';
    await prisma.actionValidation.updateMany({
      where: { id: { in: completeIds } },
      data: { status: nextStatus as any, submittedAt: new Date() },
    });
  }

  return ok({ enviadas: completeIds.length, incompletas });
}
