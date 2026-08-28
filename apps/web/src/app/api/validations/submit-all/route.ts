import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { resolveInformedExecutedValue } from '@/lib/classification-rules';
import { prisma } from '@/lib/prisma';
import { getValidationFormIssues, type ValidationFormInput } from '@/lib/validation-schema';
import { getCurrentYear, scopeWhere } from '@/lib/store';
import { logUserActivity } from '@/lib/user-activity';

/**
 * Envio consolidado: a secretaria envia de uma vez todas as suas validações
 * em RASCUNHO/DEVOLVIDO que estejam completas. As incompletas são puladas.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SECRETARIA_REPRESENTANTE') return forbidden();
  if (!user.organizationCode) return forbidden();

  const targetStatuses = ['RASCUNHO', 'DEVOLVIDO'];

  const currentYear = await getCurrentYear();
  const scope = await scopeWhere(user, currentYear);
  const rows = await prisma.actionValidation.findMany({
    where: {
      ...scope,
      action: {
        presentInCurrentQdd: true,
        ...(currentYear == null ? {} : { year: currentYear }),
      },
      status: { in: targetStatuses as any },
    },
    include: { assignment: true },
  });

  const completeIds: string[] = [];
  let incompletas = 0;

  for (const row of rows) {
    const deliveries = (Array.isArray(row.deliveries) ? row.deliveries : []) as ValidationFormInput['deliveries'];
    const classification = row.assignment?.classification ?? '';
    const values: ValidationFormInput = {
      realizedDescription: row.realizedDescription ?? '',
      informedExecutedValue: resolveInformedExecutedValue({
        theme: row.theme,
        classification,
        deliveries,
        informedExecutedValue: row.informedExecutedValue ?? 0,
      }),
      observations: row.observations ?? undefined,
      deliveries,
    };
    const items = getValidationFormIssues(values, {
      theme: row.theme,
      classification,
    });
    if (!items.length) {
      completeIds.push(row.id);
    } else {
      incompletas += 1;
    }
  }

  if (completeIds.length) {
    await prisma.actionValidation.updateMany({
      where: { id: { in: completeIds } },
      data: { status: 'ENVIADO', submittedAt: new Date() },
    });
    await logUserActivity({
      userId: user.id,
      action: 'VALIDATION_BULK_SUBMIT',
      organizationCode: user.organizationCode,
      metadata: { count: completeIds.length },
    });
  }

  return ok({ enviadas: completeIds.length, incompletas });
}
