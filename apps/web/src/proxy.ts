import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_API_PREFIXES = ['/api/health', '/api/auth/login'] as const;

function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
