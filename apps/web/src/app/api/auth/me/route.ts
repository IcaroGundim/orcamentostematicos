import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { touchLastSeen } from '@/lib/user-activity';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  await touchLastSeen(user.id, user.lastSeenAt ?? null);
  const { ...safeUser } = user as Record<string, unknown>;
  delete safeUser['password'];
  return ok(safeUser);
}
