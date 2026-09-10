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
 */
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
    const resposta = await fetch(repassada, { redirect: 'manual' });

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
