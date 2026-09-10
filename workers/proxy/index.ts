/**
 * Worker de repasse: segunda porta de entrada para o app hospedado na Vercel.
 *
 * POR QUE EXISTE. A rede da SEPLAN roda um FortiGate que retém domínios ainda não
 * categorizados pelo FortiGuard — `orcamentostematicos.vercel.app` alterna entre
 * janelas boas e janelas em que o handshake TCP simplesmente não completa. Este
 * Worker dá um segundo endereço, em outro domínio, para quando o primeiro estiver
 * retido.
 *
 * POR QUE FUNCIONA. O navegador só conversa com `*.workers.dev`. A busca à Vercel
 * acontece de dentro da rede da Cloudflare, que não passa pelo firewall — a perna
 * bloqueada deixa de existir no caminho.
 *
 * POR QUE NÃO É O APP INTEIRO AQUI. Tentamos: Next + Prisma sobre OpenNext bate no
 * limite de 10 ms de CPU do plano Free (só o cold start passa disso). Este Worker
 * não renderiza nada, então cabe com folga. O custo é não haver redundância de
 * provedor: se a Vercel cair, os dois endereços caem.
 *
 * O QUE TORNA O REPASSE SIMPLES. A sessão do app vive em `localStorage` e viaja no
 * header `Authorization: Bearer`, não em cookie. Não há domínio de cookie para
 * reescrever — só o `Location` das redireções.
 *
 * CACHE. O salto extra custa ~200-400 ms, e a página de login sozinha puxa 28
 * arquivos estáticos — é a multiplicação, não a latência isolada, que pesa. Os
 * assets do Next são imutáveis (o próprio caminho diz `/immutable/`), então ficam
 * no cache da borda e param de ir à Vercel. Rota de API e HTML NUNCA entram: são
 * dinâmicos e dependem do `Authorization`.
 */

/**
 * Política de cache da borda, por tipo de recurso.
 *
 *  - `imutavel`: asset com hash no nome. Respeita o Cache-Control da origem, que
 *    já diz `immutable, max-age=31536000`.
 *  - `pagina`: HTML. A Vercel manda `max-age=0, must-revalidate`, então
 *    `cacheEverything` sozinho NÃO cacheia e toda visita viaja até São Paulo.
 *    Aqui o TTL é forçado, porque TODAS as telas deste app são estáticas no build
 *    (`○` na saída do Next) — são cascas; os dados chegam depois via `/api`. O
 *    HTML só muda em deploy, e 60 s é o atraso máximo para a versão nova aparecer.
 *  - `nenhum`: dinâmico ou dependente do `Authorization`.
 */
type Politica = { tipo: 'imutavel' } | { tipo: 'pagina' } | { tipo: 'nenhum' };

function politica(request: Request, url: URL): Politica {
  if (request.method !== 'GET') return { tipo: 'nenhum' };
  // Payload de RSC muda com a navegação e não é página nem asset.
  if (url.searchParams.has('_rsc')) return { tipo: 'nenhum' };
  if (url.pathname.startsWith('/api/')) return { tipo: 'nenhum' };

  if (url.pathname.startsWith('/_next/static/')) return { tipo: 'imutavel' };
  if (url.pathname.startsWith('/_next/image')) return { tipo: 'imutavel' };
  if (/\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg|ico|geojson|map)$/i.test(url.pathname)) {
    return { tipo: 'imutavel' };
  }
  // Sem extensão = rota de página do Next.
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) return { tipo: 'pagina' };
  return { tipo: 'nenhum' };
}

function opcoesDeCache(request: Request, url: URL): RequestInit {
  const p = politica(request, url);
  if (p.tipo === 'imutavel') return { cf: { cacheEverything: true } } as RequestInit;
  if (p.tipo === 'pagina') {
    return { cf: { cacheEverything: true, cacheTtl: 60 } } as RequestInit;
  }
  return {};
}

interface Env {
  ORIGEM: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origem = new URL(env.ORIGEM);
    const entrada = new URL(request.url);

    const alvo = new URL(entrada.pathname + entrada.search, origem);

    // `new Request(alvo, request)` reaproveita método, headers e corpo. O Host é
    // derivado da nova URL, então a Vercel recebe o hostname dela mesma.
    const repassada = new Request(alvo, request);

    // `manual`: quem decide seguir a redireção é o navegador, não este Worker.
    // Sem isto, uma redireção seria seguida aqui dentro e o usuário nunca veria
    // a mudança de URL.
    // `cacheEverything` respeita o Cache-Control da origem — e o Next marca os
    // assets como `immutable, max-age=31536000`. Não inventamos TTL aqui.
    const resposta = await fetch(repassada, {
      redirect: 'manual',
      ...opcoesDeCache(request, entrada),
    });

    const location = resposta.headers.get('location');
    if (!location) return resposta;

    // Redireção apontando para a origem levaria o navegador ao domínio que pode
    // estar bloqueado. Reescreve para este Worker, preservando caminho e query.
    let destino: URL;
    try {
      destino = new URL(location, origem);
    } catch {
      return resposta;
    }
    if (destino.host !== origem.host) return resposta;

    const reescrita = new Headers(resposta.headers);
    reescrita.set('location', destino.pathname + destino.search + destino.hash);
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: reescrita,
    });
  },
};
