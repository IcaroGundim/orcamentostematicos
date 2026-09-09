import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Autenticação dos jobs de coleta (GitHub Actions) contra as rotas do app, por
 * segredo compartilhado `SICAF_JOB_TOKEN`. Vive aqui, e não dentro de uma rota,
 * porque duas rotas dependem dela — `from-sicaf` (gera a prévia) e `auto-publish`
 * (publica a prévia) — e um desvio entre as duas viraria um buraco de autorização.
 *
 * Isto NÃO substitui o login da SEPLAN: é uma porta paralela, restrita ao que o job
 * precisa fazer. Nenhuma rota de curadoria, validação ou usuários aceita este token.
 */
function sameSecret(received: string | null, expected: string | undefined) {
  // Painéis de secrets usam textarea e podem preservar uma quebra de linha invisível.
  // Tokens aleatórios não contêm espaços nas extremidades, então normalizar aqui é
  // seguro e evita um 401 impossível de distinguir visualmente na configuração.
  const left = Buffer.from(received?.trim() ?? '');
  const right = Buffer.from(expected?.trim() ?? '');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function jobTokenError(message: string, status: 401 | 503) {
  return NextResponse.json(
    { message, error: status === 401 ? 'Unauthorized' : 'Service Unavailable', statusCode: status },
    { status },
  );
}

export type JobAuthResult =
  /** O chamador provou ser o job. */
  | { authorized: true; response: null }
  /** O chamador se disse job e falhou: devolver `response` sem cair no login. */
  | { authorized: false; response: NextResponse }
  /** Ninguém alegou ser job; a rota decide se aceita sessão de usuário. */
  | { authorized: false; response: null };

/**
 * Quando a chamada se identifica como job mas falha, devolve a causa configuracional
 * exata. Sem isso, ambos os casos caem no login de usuário e viram o mesmo 401
 * genérico — que foi o que custou dois PRs para diagnosticar na estreia do SICAF.
 */
export function authorizeJob(req: NextRequest): JobAuthResult {
  const jobToken = req.headers.get('x-job-token');
  const expectedToken = process.env.SICAF_JOB_TOKEN;

  if (sameSecret(jobToken, expectedToken)) return { authorized: true, response: null };

  if (jobToken != null) {
    if (!expectedToken?.trim()) {
      return {
        authorized: false,
        response: jobTokenError(
          'SICAF_JOB_TOKEN não está configurado neste deployment da Vercel.',
          503,
        ),
      };
    }
    return {
      authorized: false,
      response: jobTokenError(
        'SICAF_JOB_TOKEN recebido do GitHub diverge do valor configurado na Vercel.',
        401,
      ),
    };
  }

  return { authorized: false, response: null };
}
