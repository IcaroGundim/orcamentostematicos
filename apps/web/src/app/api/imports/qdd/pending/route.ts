import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Última PRÉVIA do SICAF ainda não confirmada, no formato que a tela de importação já
 * consome (idêntico ao retorno do /imports/qdd/preview). Devolve `null` quando não há
 * prévia pendente — a coleta agendada grava uma; a SEPLAN a confirma no `confirm`.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const row = await prisma.importPreview.findFirst({
    where: { id: { startsWith: 'sicafpreview-' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return ok(null);

  const parsed = row.data as any;
  return ok({
    previewId: row.id,
    source: 'sicaf',
    generatedAt: parsed?.__generatedAt ?? row.createdAt.toISOString(),
    ...parsed.importRecord,
    yearDetectedFrom: parsed.yearDetectedFrom,
    detectedYear: parsed.detectedYear,
    detectedYearFrom: parsed.detectedYearFrom,
    sampleActions: parsed.sampleActions,
    organizationsCount: parsed.organizationsCount,
    unitsCount: parsed.unitsCount,
  });
}
