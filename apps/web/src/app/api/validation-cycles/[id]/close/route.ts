import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();
  const { id } = await params;
  const cycle = await prisma.validationCycle.update({ where: { id }, data: { status: 'ENCERRADO', closedAt: new Date() } });
  return ok(mapCycle(cycle));
}
