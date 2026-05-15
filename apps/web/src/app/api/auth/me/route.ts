import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const { ...safeUser } = user as Record<string, unknown>;
  delete safeUser['password'];
  return ok(safeUser);
}
