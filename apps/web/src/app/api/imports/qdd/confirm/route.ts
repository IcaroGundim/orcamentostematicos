import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { syncStructureFromImport } from '@/lib/government-structure';
import { addImportedBudget, reconcileExecutorsForVigenteImport } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.previewId) return badRequest('previewId é obrigatório.');

  const preview = await prisma.importPreview.findUnique({ where: { id: body.previewId } });
  if (!preview) return notFound('Prévia de importação não encontrada ou expirada.');

  const parsed = preview.data as any;
  await addImportedBudget(parsed.importRecord, parsed.actions);
  await syncStructureFromImport(parsed.actions ?? []);
  await reconcileExecutorsForVigenteImport();
  await prisma.importPreview.delete({ where: { id: body.previewId } });

  return ok({ import: parsed.importRecord, organizationsCount: parsed.organizationsCount, unitsCount: parsed.unitsCount, actionsCount: parsed.actions.length });
}
