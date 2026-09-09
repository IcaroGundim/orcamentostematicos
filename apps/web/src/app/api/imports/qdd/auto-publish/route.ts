import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { authorizeJob } from '@/lib/job-auth';
import { prisma } from '@/lib/prisma';
import { syncStructureFromImport } from '@/lib/government-structure';
import { assessAutoPublish, planQddReplacement } from '@/lib/qdd-replacement';
import {
  FiscalYearPolicyConflictError,
  reconcileExecutorsForImport,
  replaceImportedBudget,
} from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Publica a prévia pendente do SICAF SEM conferência humana, quando o delta é
 * inofensivo. É o segundo passo da coleta diária: `from-sicaf` baixa e gera a prévia,
 * esta rota decide se pode gravar.
 *
 * POR QUE UMA ROTA SEPARADA, e não o `confirm`: aquele é a porta da SEPLAN, guardada
 * por sessão e papel. Afrouxá-lo para aceitar um token de job alargaria uma fronteira
 * de autorização humana para todo mundo que a chama. Aqui a autorização do job é
 * explícita e o escopo é só este.
 *
 * POR QUE NÃO DENTRO DE `from-sicaf`: aquela rota já gasta seu orçamento de 60s
 * baixando e parseando ~7 mil linhas. Somar a escrita na mesma invocação estoura o
 * limite da Vercel. Duas chamadas = duas janelas de 60s, espelhando o que o fluxo
 * humano sempre fez (prévia, depois confirmação).
 *
 * QUANDO RECUSA, não é erro: a prévia continua de pé, o banner da SEPLAN aparece e a
 * confirmação manual segue disponível. Responde 200 com `published: false` e o motivo,
 * porque falhar o job por um QDD suspeito só produziria alarme sem ação.
 */
export async function POST(req: NextRequest) {
  const job = authorizeJob(req);
  if (job.response) return job.response;

  let updatedBy: string | null = null;
  if (!job.authorized) {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (user.role !== 'SEPLAN_ADMIN') return forbidden();
    updatedBy = user.id;
  }

  const preview = await prisma.importPreview.findFirst({
    where: { id: { startsWith: 'sicafpreview-' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!preview) return ok({ published: false, reason: 'Nenhuma prévia do SICAF pendente.' });

  const parsed = preview.data as any;
  const importRecord = parsed?.importRecord;
  const year = Number(importRecord?.year);
  if (!Number.isInteger(year)) return badRequest('Exercício da prévia inválido.');

  const actions = (parsed.actions ?? []) as any[];

  // NUNCA criar exercício sozinho. Um ano novo implica decidir `comparisonOnly`, que
  // `docs/ingestao-qdd-sicaf.md` reserva à SEPLAN — a política é gravada na criação do
  // `FiscalYear` e não é revista depois. Ano inédito cai no fluxo manual de sempre.
  const base = await prisma.budgetImport.findUnique({
    where: { year },
    select: { id: true, actionCount: true },
  });
  if (!base) {
    return ok({
      published: false,
      year,
      reason:
        `O exercício ${year} ainda não tem base vigente. A primeira importação de um ` +
        `exercício define se ele é apenas comparativo e cabe à SEPLAN confirmar.`,
    });
  }

  // Mesmo recorte que `replaceImportedBudget` usa para montar o plano, para que a
  // decisão seja tomada sobre exatamente o que a escrita faria.
  const existing = await prisma.budgetAction.findMany({
    where: { importId: base.id },
    select: {
      id: true,
      year: true,
      organizationCode: true,
      unitCode: true,
      projectActivity: true,
      application: true,
      presentInCurrentQdd: true,
      _count: { select: { assignments: true, validations: true } },
    },
  });

  let verdict;
  try {
    const plan = planQddReplacement(
      existing.map((action) => ({
        ...action,
        hasAssignments: action._count.assignments > 0,
        hasValidations: action._count.validations > 0,
      })),
      actions,
    );
    verdict = assessAutoPublish({
      plan,
      currentActionCount: existing.filter((a) => a.presentInCurrentQdd).length,
      incomingActionCount: actions.length,
    });
  } catch (error: any) {
    // Chave lógica duplicada aborta o plano. É defeito do arquivo, não do banco.
    return ok({ published: false, year, reason: error?.message ?? 'Falha ao planejar a atualização.' });
  }

  if (!verdict.safe) {
    return ok({ published: false, year, reason: verdict.reason, previewId: preview.id });
  }

  let replacement;
  try {
    replacement = await replaceImportedBudget(
      importRecord,
      actions,
      { updatedBy, source: 'SICAF', confirmationKey: preview.id },
      false,
    );
  } catch (error) {
    if (error instanceof FiscalYearPolicyConflictError) {
      return ok({ published: false, year, reason: error.message, previewId: preview.id });
    }
    throw error;
  }

  await syncStructureFromImport(actions, year);
  await reconcileExecutorsForImport(year, actions);
  await prisma.importPreview.deleteMany({ where: { id: preview.id } });

  return ok({
    published: true,
    year,
    importId: replacement.importId,
    filename: importRecord.filename,
    createdActions: replacement.createdActions,
    updatedActions: replacement.updatedActions,
    inactivatedActions: replacement.inactivatedActions,
    reactivatedActions: replacement.reactivatedActions,
    deletedActions: replacement.deletedActions,
    preservedAssignments: replacement.preservedAssignments,
  });
}
