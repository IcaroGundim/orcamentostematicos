import { Prisma } from '@/lib/prisma-client';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { badRequest, ok, unauthorized } from '@/lib/auth-server';
import {
  loginRateLimitKey,
  loginRateLimitLockId,
  nextLoginFailure,
  retryAfterSeconds,
} from '@/lib/login-rate-limit';
import { sessionExpiryCutoff } from '@/lib/session-lifetime';

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
  if (!rawIdentifier || typeof body?.password !== 'string' || !body.password) {
    return badRequest('Informe e-mail ou nome de usuário e a senha.');
  }
  const identifier = String(rawIdentifier).toLowerCase().trim();
  if (!identifier || identifier.length > 254) return badRequest('Identificador inválido.');

  let result;
  try {
    // A tabela é compartilhada por todas as instâncias. Limpeza rara e limitada
    // evita que identificadores inexistentes acumulem linhas sem travar o login.
    if (Math.random() < 0.02) {
      const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
      await prisma.$executeRaw`
        DELETE FROM "LoginRateLimit"
        WHERE "key" IN (
          SELECT "key" FROM "LoginRateLimit"
          WHERE "windowStartedAt" < ${staleBefore}
          ORDER BY "windowStartedAt"
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        )
      `;
    }
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
      });
      const key = loginRateLimitKey(user ? 'user' : 'identifier', user?.id ?? identifier);

      // O lock torna a quinta falha efetiva mesmo com requisições simultâneas.
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock($1::integer, $2::integer)::text AS lock_result',
        20260916,
        loginRateLimitLockId(key),
      );

      const now = new Date();
      const current = await tx.loginRateLimit.findUnique({ where: { key } });
      if (current?.blockedUntil && current.blockedUntil > now) {
        return { kind: 'blocked', retryAfter: retryAfterSeconds(current.blockedUntil, now) } as const;
      }

      if (!user || user.active === false || user.password !== body.password) {
        const next = nextLoginFailure(current, now);
        await tx.loginRateLimit.upsert({
          where: { key },
          create: { key, ...next },
          update: next,
        });
        return next.blockedUntil
          ? { kind: 'blocked', retryAfter: retryAfterSeconds(next.blockedUntil, now) } as const
          : { kind: 'invalid' } as const;
      }

      await tx.loginRateLimit.deleteMany({ where: { key } });
      // Descarta as sessões já expiradas DESTE usuário. É aqui que a limpeza sai
      // de graça: o login já escreve, e o recorte por usuário mantém a operação
      // pequena — sem varredura global e sem tocar em sessão de terceiro.
      await tx.session.deleteMany({
        where: { userId: user.id, createdAt: { lt: sessionExpiryCutoff(now) } },
      });
      const token = randomBytes(32).toString('hex');
      await tx.session.create({ data: { token, userId: user.id } });
      const { password: _pw, ...safeUser } = user;
      return { kind: 'success', token, user: safeUser } as const;
    }, {
      // `maxWait` é o tempo para CONSEGUIR uma conexão e abrir a transação, e o
      // padrão do Prisma (2s) não cabe aqui: o compute do Neon suspende quando
      // ocioso e a primeira conexão depois disso leva de 1,3s a 2,0s — medido.
      // Estourar esse limite derruba o login inteiro com
      // "P2028: Unable to start a transaction in the given time", que chega ao
      // usuário como "Erro ao acessar a API" e não diz nada sobre a causa.
      // 10s é o mesmo valor já usado nas transações pesadas (`store.ts`).
      maxWait: 10000,
      // O corpo tem seis idas ao banco em sequência, uma delas um
      // `pg_advisory_xact_lock`. Em rede lenta isso encosta no padrão de 5s.
      timeout: 15000,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'ECONNREFUSED'
    ) {
      return databaseUnavailable();
    }
    // P2028 é a transação que não conseguiu abrir a tempo — tipicamente o banco
    // despertando do modo ocioso. Sem este ramo o erro sobe como 500 sem corpo, e
    // o `api.ts` mostra "Erro ao acessar a API", que não diz o que houve nem o que
    // fazer. Aqui o usuário lê que é lentidão momentânea e que basta repetir.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
      return NextResponse.json(
        {
          message: 'O banco de dados demorou a responder. Tente entrar novamente em alguns segundos.',
          error: 'Service Unavailable',
          statusCode: 503,
        },
        { status: 503, headers: { 'Retry-After': '5' } },
      );
    }
    throw error;
  }
  if (result.kind === 'blocked') {
    return NextResponse.json(
      { message: 'Muitas tentativas de login. Aguarde e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
    );
  }
  if (result.kind === 'invalid') return unauthorized();
  return ok({ token: result.token, user: result.user });
}
