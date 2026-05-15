import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { listActions } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const filters = {
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    organizationCode: searchParams.get('organizationCode') ?? undefined,
    unitCode: searchParams.get('unitCode') ?? undefined,
  };

  return ok(await listActions(user, filters));
}
