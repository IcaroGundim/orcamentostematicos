import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { badRequest, ok, unauthorized } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) return badRequest('E-mail e senha são obrigatórios.');

  const user = await prisma.user.findUnique({ where: { email: String(body.email).toLowerCase() } });
  if (!user || user.password !== body.password) return unauthorized();

  const token = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { token, userId: user.id } });

  const { password: _pw, ...safeUser } = user;
  return ok({ token, user: safeUser });
}
