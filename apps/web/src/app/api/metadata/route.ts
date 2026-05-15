import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const vigenteImport = await prisma.budgetImport.findFirst({ where: { status: 'VIGENTE' } });
  return ok({
    vigenteImport: vigenteImport ? {
      id: vigenteImport.id,
      filename: vigenteImport.filename,
      year: vigenteImport.year,
      referenceMonth: vigenteImport.referenceMonth,
      periodType: vigenteImport.periodType,
      importedAt: vigenteImport.importedAt.toISOString(),
      rowCount: vigenteImport.rowCount,
      actionCount: vigenteImport.actionCount,
      status: vigenteImport.status,
    } : null,
  });
}
