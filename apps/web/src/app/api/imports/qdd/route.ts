import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapImport } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const rows = await prisma.budgetImport.findMany({
    orderBy: [{ year: 'desc' }, { status: 'desc' }, { importedAt: 'desc' }],
  });
  const onePerYear = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!onePerYear.has(row.year)) onePerYear.set(row.year, row);
  }
  return ok([...onePerYear.values()].map(mapImport));
}
