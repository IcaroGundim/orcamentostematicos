import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { buildStructureDiff } from '@/lib/government-structure';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const source = req.nextUrl.searchParams.get('source');
  if (source !== 'preview' && source !== 'vigente') {
    return badRequest('source deve ser preview ou vigente.');
  }

  const previewId = req.nextUrl.searchParams.get('previewId') ?? undefined;
  if (source === 'preview' && !previewId) {
    return badRequest('previewId é obrigatório quando source=preview.');
  }

  try {
    return ok(await buildStructureDiff(source, previewId));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Erro ao calcular diferenças.');
  }
}
