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

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseQdd(file.name, buffer, createId, { periodType, referenceMonth });
  } catch (err: any) {
    return badRequest(err?.message ?? 'Erro ao processar o arquivo.');
  }

  const previewId = createId('preview');
  await prisma.importPreview.create({ data: { id: previewId, data: parsed as any } });

  return ok({ previewId, ...parsed.importRecord, sampleActions: parsed.sampleActions, organizationsCount: parsed.organizationsCount, unitsCount: parsed.unitsCount });
}
