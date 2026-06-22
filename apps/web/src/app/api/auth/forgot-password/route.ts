import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { badRequest, ok } from '@/lib/auth-server';
import { sendPasswordResetEmail } from '@/lib/email';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

// Resposta sempre genérica para não revelar se um e-mail/usuário existe.
const GENERIC_RESPONSE = {
  message:
    'Se houver uma conta com esses dados, enviaremos um e-mail com instruções para redefinir a senha.',
};

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawIdentifier = body?.identifier ?? body?.email;
  if (!rawIdentifier) {
    return badRequest('Informe seu e-mail ou nome de usuário.');
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

  // Só envia se houver usuário ativo com e-mail; caso contrário, responde igual.
  if (user && user.active !== false && user.email) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // Invalida pedidos anteriores e cria o novo.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const base = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const link = `${base}/login?token=${token}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, link);
    } catch (error) {
      // Não vaza o resultado para o cliente, mas registra para diagnóstico.
      console.error('[forgot-password] falha ao enviar e-mail:', error);
    }
  }

  return ok(GENERIC_RESPONSE);
}
