import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, conflict } from '@/lib/auth-server';
import { deleteBudgetImportPreservingAssignments, mapImport } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ importId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { importId } = await params;

  const result = await deleteBudgetImportPreservingAssignments(importId);
  if (!result.target) return notFound('Importação não encontrada.');
  if (result.unmatched.length > 0) {
    return conflict(
      `A importação não foi excluída para preservar ${result.unmatched.length} ` +
      `classificaç${result.unmatched.length === 1 ? 'ão' : 'ões'} sem ação correspondente em outro QDD.`,
    );
  }

  return ok({ deleted: mapImport(result.target), reattachedAssignments: result.reattached });
}
