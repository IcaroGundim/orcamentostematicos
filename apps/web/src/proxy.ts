import { NextRequest, NextResponse } from 'next/server';

// A rota do coletor faz a própria autenticação por `x-job-token`. Ela precisa passar
// pelo proxy para que o handler consiga validar o segredo compartilhado com o GitHub.
const PUBLIC_API_PREFIXES = ['/api/health', '/api/auth/login'] as const;
const JOB_AUTHENTICATED_ROUTE = '/api/imports/qdd/from-sicaf';

function isPublicApiRoute(pathname: string) {
  return (
    pathname === JOB_AUTHENTICATED_ROUTE ||
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
