import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import {
  applyStructureDiff,
  buildStructureDiffFromContext,
  loadDiffContext,
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

  // Para `vigente` o exercício vem do contexto; para `preview` ele é DERIVADO DA
  // PRÓPRIA PRÉVIA dentro de `loadDiffContext` e o parâmetro é ignorado. Esta rota
  // grava no cadastro — deixar o ano vir do seletor do cabeçalho foi exatamente o
  // que faria a estrutura de um exercício sobrescrever a de outro.
  const exercise = await resolveRequestYear(
    req,
    user,
    source === 'vigente' ? { mode: 'strict' } : {},
  );
  if (exercise.response) return exercise.response;

  try {
    const context = await loadDiffContext(source, previewId, exercise.year);
    if (context.year == null) return badRequest('Nenhum exercício vigente.');

    const diff = await buildStructureDiffFromContext(context);
    await applyStructureDiff(diff, context.pairs, selection, context.year);
    return ok({ applied: true, year: context.year });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Erro ao aplicar diferenças.');
  }
}
