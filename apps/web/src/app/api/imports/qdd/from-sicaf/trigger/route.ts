import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Dispara a coleta do QDD no SICAF a partir da interface — sem sair da tela da SEPLAN.
 *
 * A raspagem em si NÃO roda aqui: ela depende de sessão GeneXus e do TLS da SEFAZ, que
 * não cabem no serverless da Vercel (ver docs/ingestao-qdd-sicaf.md). Então esta rota
 * apenas aciona o workflow `qdd.yml` no GitHub Actions (`workflow_dispatch`), que faz a
 * raspagem e devolve a PRÉVIA pela rota /imports/qdd/from-sicaf. Segundos depois a prévia
 * aparece no banner da tela.
 *
 * Requer:
 *  - GITHUB_DISPATCH_TOKEN: PAT (fine-grained) com permissão Actions: read/write no repo;
 *  - GITHUB_REPO: "owner/repo" (default do repositório do projeto);
 *  - GITHUB_WORKFLOW_REF: branch de onde rodar (default "main"). O workflow precisa existir
 *    na branch DEFAULT do repo para o dispatch ser aceito pelo GitHub.
 */
function serviceUnavailable(message: string) {
  return NextResponse.json({ message, error: 'Service Unavailable', statusCode: 503 }, { status: 503 });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? 'IcaroGundim/orcamentostematicos';
  const ref = process.env.GITHUB_WORKFLOW_REF ?? 'main';
  if (!token) {
    return serviceUnavailable(
      'Coleta pela interface indisponível: defina GITHUB_DISPATCH_TOKEN (PAT com Actions: write) ' +
        'nas variáveis de ambiente. Enquanto isso, a coleta agendada continua funcionando.',
    );
  }

  const body = await req.json().catch(() => ({}));
  const inputs: Record<string, string> = {};
  if (body?.exercicio != null && String(body.exercicio) !== '') {
    const y = Number(body.exercicio);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return badRequest('Exercício inválido.');
    inputs.exercicio = String(y);
  }
  if (body?.mes != null && String(body.mes) !== '') {
    const m = Number(body.mes);
    if (!Number.isInteger(m) || m < 1 || m > 12) return badRequest('Mês inválido.');
    inputs.mes = String(m);
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/qdd.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'orcamentos-tematicos',
    },
    body: JSON.stringify({ ref, inputs }),
  }).catch(() => null);

  if (!res) return serviceUnavailable('Não foi possível contatar o GitHub Actions.');
  if (res.status === 204) return ok({ dispatched: true, ref });

  const detail = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) {
    return serviceUnavailable('GITHUB_DISPATCH_TOKEN inválido ou sem permissão Actions: write.');
  }
  if (res.status === 404) {
    return serviceUnavailable(
      `Workflow qdd.yml não encontrado na branch "${ref}" de ${repo}. ` +
        'Ele precisa estar mesclado na branch default do repositório.',
    );
  }
  return serviceUnavailable(`GitHub recusou o disparo (HTTP ${res.status}): ${detail.slice(0, 300)}`);
}
