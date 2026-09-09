import { NextRequest, NextResponse } from 'next/server';

// As rotas do coletor fazem a própria autenticação por `x-job-token` (`lib/job-auth.ts`).
// Precisam passar pelo proxy para que o handler consiga validar o segredo compartilhado
// com o GitHub — o proxy só sabe checar `Authorization: Bearer`, que o job não tem.
//
// Deixar de listar aqui uma rota de job é uma falha SILENCIOSA e confusa: o proxy
// devolve o mesmo 401 genérico de uma rota inexistente, então o handler parece não ter
// sido publicado. Foi o que aconteceu com `auto-publish` na primeira execução real.
const PUBLIC_API_PREFIXES = ['/api/health', '/api/auth/login'] as const;
const JOB_AUTHENTICATED_ROUTES = [
  '/api/imports/qdd/from-sicaf',
  '/api/imports/qdd/auto-publish',
] as const;

function isPublicApiRoute(pathname: string) {
  return (
    JOB_AUTHENTICATED_ROUTES.some((route) => pathname === route) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/') || isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return NextResponse.json(
      { message: 'Não autorizado.', error: 'Unauthorized', statusCode: 401 },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
