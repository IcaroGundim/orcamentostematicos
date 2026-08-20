import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden } from './auth-server';
import { resolveExerciseYear, type ScopedUser } from './store';

/** Faixa aceita para um exercício financeiro — descarta lixo e erro de digitação. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * Lê o exercício da query (`?year=` ou `?exercicio=`) e aplica o controle de
 * acesso: exercícios apenas comparativos são exclusivos da SEPLAN.
 *
 * Devolve `{ response }` quando a requisição deve ser recusada, ou `{ year }` com
 * o exercício resolvido — `null` quando ainda não há nenhum QDD importado.
 *
 * O `Number.isInteger` é deliberado: `Number('abc')` é `NaN`, que é falsy e antes
 * fazia a rota cair silenciosamente no exercício corrente em vez de recusar.
 */
export type ResolveYearOptions = {
  /**
   * `'strict'` — usado por rotas que ESCREVEM: o exercício tem de vir na requisição
   * e tem de existir. Um ano ausente ou desconhecido é recusado em vez de virar o
   * corrente, porque gravar no exercício errado é irreversível na prática.
   *
   * `'lenient'` (padrão) — usado pelas leituras: um link antigo com um exercício que
   * não existe mais abre no corrente em vez de quebrar a tela.
   */
  mode?: 'strict' | 'lenient';
};

export async function resolveRequestYear(
  req: NextRequest,
  user: ScopedUser,
  options: ResolveYearOptions = {},
): Promise<{ year: number | null; response?: undefined } | { year?: undefined; response: NextResponse }> {
  const strict = options.mode === 'strict';
  const raw =
    req.nextUrl.searchParams.get('year') ?? req.nextUrl.searchParams.get('exercicio');

  let requested: number | null = null;
  if (raw != null && raw !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < MIN_YEAR || parsed > MAX_YEAR) {
      return { response: badRequest('Exercício inválido.') };
    }
    requested = parsed;
  }

  // `resolveExerciseYear` devolve cedo quando `requested` é nulo, então a ausência
  // do parâmetro precisa ser barrada AQUI — é ela, e não o ano desconhecido, que
  // acontece de verdade quando um botão esquece de informar o exercício.
  if (strict && requested == null) {
    return { response: badRequest('Informe o exercício desta operação.') };
  }

  const { year, forbidden: denied } = await resolveExerciseYear(user, requested);
  if (denied) return { response: forbidden() };

  if (strict && requested != null && year !== requested) {
    return { response: badRequest(`Exercício ${requested} não encontrado.`) };
  }
  return { year };
}
