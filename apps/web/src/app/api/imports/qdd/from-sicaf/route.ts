import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { parseQdd } from '@/lib/qdd-parser';
import { createId } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Recebe os BYTES do QDD "Saldo Retroativo" já exportado do SICAF e gera uma PRÉVIA,
 * exatamente como o upload manual — reaproveitando o `parseQdd` já validado. Não grava
 * nada no orçamento: a escrita continua no `confirm`, sob conferência da SEPLAN.
 *
 * Duas portas de entrada:
 *  - SEPLAN logada (Bearer de sessão), para uso interativo;
 *  - o job de coleta (.github/workflows/qdd.yml), autenticado por `x-job-token` =
 *    `SICAF_JOB_TOKEN`. O job roda no GitHub Actions (não na Vercel) porque a raspagem
 *    do SICAF depende de sessão GeneXus e TLS que não cabem no serverless — ver
 *    `apps/web/scripts/fetch-sicaf-qdd.mjs` e `docs/ingestao-qdd-sicaf.md`.
 *
 * A prévia do SICAF é marcada com o prefixo de id `sicafpreview-` para que uma nova
 * coleta substitua a anterior ainda não confirmada (idempotência, como a folha).
 */
export async function POST(req: NextRequest) {
  const jobToken = req.headers.get('x-job-token');
  const expectedToken = process.env.SICAF_JOB_TOKEN;
  const authorizedByJob = Boolean(expectedToken && jobToken && jobToken === expectedToken);

  if (!authorizedByJob) {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (user.role !== 'SEPLAN_ADMIN') return forbidden();
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return badRequest('Envie o arquivo do QDD do SICAF no campo file.');

  const file = formData.get('file') as File | null;
  if (!file) return badRequest('Envie o arquivo do QDD do SICAF no campo file.');

  const periodType = (formData.get('periodType') as string | null) ?? 'ACUMULADO_ANUAL';
  const referenceMonth = Number(formData.get('referenceMonth'));
  if (!referenceMonth || referenceMonth < 1 || referenceMonth > 12) {
    return badRequest('referenceMonth (1-12) é obrigatório.');
  }

  // O EXERCÍCIO é obrigatório aqui: o job conhece o `vEXRORC` que consultou, então
  // manda o ano explícito. Deixar o parser adivinhar pelo nome do arquivo é o que faz
  // uma exportação carimbada em janeiro/2027 cair no exercício 2026 errado — a mesma
  // classe de bug que o CLAUDE.md descreve em "quem conhece o próprio exercício vence
  // o contexto".
  const rawYear = formData.get('year');
  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return badRequest('Exercício (year) explícito é obrigatório na coleta do SICAF.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseQdd(file.name, buffer, createId, { periodType, referenceMonth, year });
  } catch (err: any) {
    return badRequest(err?.message ?? 'Erro ao processar o QDD do SICAF.');
  }

  const previewId = createId('sicafpreview');
  const data = { ...parsed, __source: 'sicaf', __generatedAt: new Date().toISOString() };

  // Substitui prévias do SICAF ainda não confirmadas: a coleta é idempotente e não deve
  // acumular pendências. Só apaga as do SICAF (prefixo), nunca as de upload manual.
  await prisma.$transaction([
    prisma.importPreview.deleteMany({ where: { id: { startsWith: 'sicafpreview-' } } }),
    prisma.importPreview.create({ data: { id: previewId, data: data as any } }),
  ]);

  return ok({
    previewId,
    source: 'sicaf',
    ...parsed.importRecord,
    yearDetectedFrom: parsed.yearDetectedFrom,
    detectedYear: parsed.detectedYear,
    detectedYearFrom: parsed.detectedYearFrom,
    sampleActions: parsed.sampleActions,
    organizationsCount: parsed.organizationsCount,
    unitsCount: parsed.unitsCount,
  });
}
