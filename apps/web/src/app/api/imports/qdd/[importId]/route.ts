import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapImport } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ importId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { importId } = await params;

  const deleted = await prisma.$transaction(async (tx) => {
    const target = await tx.budgetImport.findUnique({ where: { id: importId } });
    if (!target) return null;

    await tx.actionValidation.deleteMany({
      where: { action: { importId } },
    });

    await tx.budgetImport.delete({ where: { id: importId } });

    const vigente = await tx.budgetImport.findFirst({
      where: { status: 'VIGENTE' },
      orderBy: { importedAt: 'desc' },
      select: { id: true },
    });

    if (!vigente) {
      const nextImport = await tx.budgetImport.findFirst({
        orderBy: { importedAt: 'desc' },
      });

      if (nextImport) {
        await tx.budgetImport.update({
          where: { id: nextImport.id },
          data: { status: 'VIGENTE' },
        });
      }
    }

    return target;
  }, {
    maxWait: 10000,
    timeout: 60000,
  });

  if (!deleted) return notFound('Importação não encontrada.');

  return ok({ deleted: mapImport(deleted) });
}
