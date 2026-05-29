import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { badRequest, ok, unauthorized } from '@/lib/auth-server';

function databaseUnavailable() {
  return NextResponse.json(
    {
      message:
        'Banco de dados não configurado ou indisponível. Defina DATABASE_URL em apps/web/.env.local (copie da Vercel ou do Neon) e reinicie o servidor.',
      error: 'Service Unavailable',
      statusCode: 503,
    },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawIdentifier = body?.identifier ?? body?.email;
  if (!rawIdentifier || !body?.password) {
    return badRequest('Informe e-mail ou nome de usuário e a senha.');
  }
  const identifier = String(rawIdentifier).toLowerCase().trim();

  let user;
  try {
    user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'ECONNREFUSED'
    ) {
      return databaseUnavailable();
    }
    throw error;
  }
  if (!user || user.password !== body.password) return unauthorized();

  const token = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { token, userId: user.id } });

  const { password: _pw, ...safeUser } = user;
  return ok({ token, user: safeUser });
}
