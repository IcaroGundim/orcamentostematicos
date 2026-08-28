import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { syncStructureFromImport } from '@/lib/government-structure';
import {
  FiscalYearPolicyConflictError,
  reconcileExecutorsForImport,
  replaceImportedBudget,
} from '@/lib/store';

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
  const year = Number(parsed?.importRecord?.year);
  if (!Number.isInteger(year)) return badRequest('Exercício da prévia inválido.');

  const comparisonOnly = Boolean(body?.comparisonOnly);

  let replacement;
  try {
    replacement = await replaceImportedBudget(
      parsed.importRecord,
      parsed.actions,
      {
        updatedBy: user.id,
        source: body.previewId.startsWith('sicafpreview-') ? 'SICAF' : 'MANUAL',
        confirmationKey: body.previewId,
      },
      comparisonOnly,
    );
  } catch (error) {
    if (error instanceof FiscalYearPolicyConflictError) {
      return badRequest(
        `${error.message} Ajuste a opção da importação ou altere a política do exercício.`,
      );
    }
    throw error;
  }

  // A estrutura é sincronizada no cadastro DO EXERCÍCIO, então importar um ano
  // nunca renomeia nem reativa órgãos/unidades de outro.
  await syncStructureFromImport(parsed.actions ?? [], year);
  await reconcileExecutorsForImport(year, parsed.actions ?? []);
  await prisma.importPreview.deleteMany({ where: { id: body.previewId } });

  return ok({
    import: { ...parsed.importRecord, id: replacement.importId, status: 'VIGENTE' },
    comparisonOnly,
    organizationsCount: parsed.organizationsCount,
    unitsCount: parsed.unitsCount,
    actionsCount: parsed.actions.length,
    createdActions: replacement.createdActions,
    updatedActions: replacement.updatedActions,
    inactivatedActions: replacement.inactivatedActions,
    reactivatedActions: replacement.reactivatedActions,
    deletedActions: replacement.deletedActions,
    preservedAssignments: replacement.preservedAssignments,
    inactiveActions: replacement.inactiveActions,
  });
}
