import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { parseQdd } from '@/lib/qdd-parser';
import { createId } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const formData = await req.formData().catch(() => null);
  if (!formData) return badRequest('Envie um arquivo QDD no campo file.');

  const file = formData.get('file') as File | null;
  if (!file) return badRequest('Envie um arquivo QDD no campo file.');

  const periodType = formData.get('periodType') as string | null;
  const referenceMonth = Number(formData.get('referenceMonth'));
  if (!periodType || !referenceMonth || referenceMonth < 1 || referenceMonth > 12) {
    return badRequest('periodType e referenceMonth são obrigatórios.');
  }

  // Exercício escolhido pela SEPLAN. Opcional: sem ele, o parser detecta pelo
  // arquivo, como antes.
  const rawYear = formData.get('year');
  let year: number | null = null;
  if (rawYear != null && String(rawYear) !== '') {
    year = Number(rawYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return badRequest('Exercício inválido.');
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseQdd(file.name, buffer, createId, { periodType, referenceMonth, year });
  } catch (err: any) {
    return badRequest(err?.message ?? 'Erro ao processar o arquivo.');
  }

  // Prévia de upload manual guarda o QDD inteiro (~1 MB de JSON) e só é apagada
  // pelo `confirm`. Prévia aberta e abandonada ficava para sempre: 7 órfãs, a mais
  // antiga de 4 meses, foram encontradas em produção. Aqui a limpeza é por IDADE,
  // não por prefixo como em `from-sicaf`: aquele caminho é um slot único de máquina,
  // enquanto duas SEPLAN podem legitimamente ter prévias abertas ao mesmo tempo —
  // e não há coluna de dono em `ImportPreview` para restringir por usuário.
  const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
  await prisma.importPreview.deleteMany({
    where: {
      id: { startsWith: 'preview-' },
      createdAt: { lt: new Date(Date.now() - PREVIEW_TTL_MS) },
    },
  });

  const previewId = createId('preview');
  await prisma.importPreview.create({ data: { id: previewId, data: parsed as any } });

  return ok({
    previewId,
    ...parsed.importRecord,
    yearDetectedFrom: parsed.yearDetectedFrom,
    detectedYear: parsed.detectedYear,
    detectedYearFrom: parsed.detectedYearFrom,
    sampleActions: parsed.sampleActions,
    organizationsCount: parsed.organizationsCount,
    unitsCount: parsed.unitsCount,
  });
}
