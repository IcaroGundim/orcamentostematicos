import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const cycle = await prisma.validationCycle.findUnique({
    where: { id },
    include: { validations: { where: { action: { presentInCurrentQdd: true } } } },
  });
  if (!cycle) return notFound('Ciclo não encontrado.');
  return ok({ ...mapCycle(cycle), validations: cycle.validations });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();
  const { id } = await params;
  await prisma.validationCycle.delete({ where: { id } }).catch(() => null);
  return ok({ success: true });
}
