import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { syncStructureFromImport } from '@/lib/government-structure';
import { addImportedBudget, reconcileExecutorsForImport } from '@/lib/store';

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

  // A política é do EXERCÍCIO, não da importação: quem manda é a primeira
  // importação do ano. Divergir aqui trocaria o regime de entregas de um exercício
  // inteiro sem que ninguém tivesse pedido — por isso recusamos em vez de aplicar.
  const existingPolicy = await prisma.fiscalYear.findUnique({
    where: { year },
    select: { comparisonOnly: true },
  });
  if (existingPolicy && existingPolicy.comparisonOnly !== comparisonOnly) {
    return badRequest(
      existingPolicy.comparisonOnly
        ? `O exercício ${year} já está registrado como apenas comparativo. Reimporte com essa opção marcada ou altere a política do exercício.`
        : `O exercício ${year} já está registrado como exercício completo. Reimporte sem marcar "apenas para comparação" ou altere a política do exercício.`,
    );
  }

  const reattach = await addImportedBudget(parsed.importRecord, parsed.actions);

  // `create`-only: a política nasce na primeira importação do exercício e não é
  // alterada por reimportação.
  await prisma.fiscalYear.upsert({
    where: { year },
    create: { year, comparisonOnly },
    update: {},
  });

  // A estrutura é sincronizada no cadastro DO EXERCÍCIO, então importar um ano
  // nunca renomeia nem reativa órgãos/unidades de outro.
  await syncStructureFromImport(parsed.actions ?? [], year);
  await reconcileExecutorsForImport(year, parsed.actions ?? []);
  await prisma.importPreview.delete({ where: { id: body.previewId } });

  return ok({
    import: parsed.importRecord,
    comparisonOnly,
    organizationsCount: parsed.organizationsCount,
    unitsCount: parsed.unitsCount,
    actionsCount: parsed.actions.length,
    reattachedAssignments: reattach.reattached,
    unmatchedAssignments: reattach.unmatched,
  });
}
