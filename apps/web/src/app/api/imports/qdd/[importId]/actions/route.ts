import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapAction } from '@/lib/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ importId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { importId } = await params;
  const rows = await prisma.budgetAction.findMany({
    where: { importId, presentInCurrentQdd: true },
    include: { expenseLines: true },
  });
  return ok(rows.map(mapAction));
}
