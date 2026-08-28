import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, conflict } from '@/lib/auth-server';
import { deleteBudgetImportIfUncurated, mapImport } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ importId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { importId } = await params;

  const result = await deleteBudgetImportIfUncurated(importId);
  if (!result.target) return notFound('Importação não encontrada.');
  if (result.assignments > 0 || result.validations > 0) {
    return conflict(
      'A base não pode ser excluída porque o exercício possui classificações temáticas ou validações.',
    );
  }

  return ok({ deleted: mapImport(result.target) });
}
