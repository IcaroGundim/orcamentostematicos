import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import {
  applyStructureDiff,
  buildStructureDiff,
  getQddPairsForDiff,
} from '@/lib/government-structure';
import type { StructureDiffApplySelection } from '@/types/domain';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  const source = body?.source;
  if (source !== 'preview' && source !== 'vigente') {
    return badRequest('source deve ser preview ou vigente.');
  }

  const previewId = body?.previewId as string | undefined;
  if (source === 'preview' && !previewId) {
    return badRequest('previewId é obrigatório quando source=preview.');
  }

  const selection = (body?.selection ?? {}) as StructureDiffApplySelection;

  try {
    const [diff, qddPairs] = await Promise.all([
      buildStructureDiff(source, previewId),
      getQddPairsForDiff(source, previewId),
    ]);
    await applyStructureDiff(diff, qddPairs, selection);
    return ok({ applied: true });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Erro ao aplicar diferenças.');
  }
}
