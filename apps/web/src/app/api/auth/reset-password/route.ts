import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, ok } from '@/lib/auth-server';

function databaseUnavailable() {
  return NextResponse.json(
    {
      message:
        'Banco de dados não configurado ou indisponível. Defina DATABASE_URL em apps/web/.env.local e reinicie o servidor.',
      error: 'Service Unavailable',
      statusCode: 503,
    },
    { status: 503 },
  );
}

function isTokenUsable(record: { expiresAt: Date; usedAt: Date | null } | null): boolean {
  if (!record) return false;
  if (record.usedAt) return false;
  return record.expiresAt.getTime() > Date.now();
}

// Valida o token sem consumi-lo — usado pela página antes de exibir o formulário.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return ok({ valid: false });

  let record;
  try {
    record = await prisma.passwordResetToken.findUnique({ where: { token } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'ECONNREFUSED'
    ) {
      return databaseUnavailable();
    }
    throw error;
  }

  return ok({ valid: isTokenUsable(record) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token ? String(body.token).trim() : '';
  const password = body?.password ? String(body.password) : '';

  if (!token) return badRequest('Link inválido.');
  if (password.length < 3) {
    return badRequest('A senha deve ter pelo menos 3 caracteres.');
  }

  let record;
  try {
    record = await prisma.passwordResetToken.findUnique({ where: { token } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'ECONNREFUSED'
    ) {
      return databaseUnavailable();
    }
    throw error;
  }

  if (!isTokenUsable(record)) {
    return badRequest('Link inválido ou expirado. Solicite uma nova redefinição.');
  }

  // Atualiza a senha (mantido em texto puro, como o restante do sistema hoje),
  // marca o token como usado e encerra as sessões ativas do usuário.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record!.userId },
      data: { password },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record!.userId } }),
  ]);

  return ok({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
}
