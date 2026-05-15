import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationCode?: string | null;
  unitCode?: string | null;
};

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  return session ? session.user : null;
}

export function unauthorized() {
  return NextResponse.json({ message: 'Não autorizado.', error: 'Unauthorized', statusCode: 401 }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ message: 'Acesso negado.', error: 'Forbidden', statusCode: 403 }, { status: 403 });
}

export function notFound(message = 'Não encontrado.') {
  return NextResponse.json({ message, error: 'Not Found', statusCode: 404 }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message, error: 'Bad Request', statusCode: 400 }, { status: 400 });
}

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export function requireRoles(user: AuthUser | null, ...roles: string[]): NextResponse | null {
  if (!user) return unauthorized();
  if (!roles.includes(user.role)) return forbidden();
  return null;
}
