import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
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

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  try {
    return ok(await buildStructureDiff(source, previewId, exercise.year));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Erro ao calcular diferenças.');
  }
}
