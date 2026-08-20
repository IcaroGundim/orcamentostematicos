import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { listActions } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  const { searchParams } = new URL(req.url);
  const filters = {
    year: exercise.year ?? undefined,
    organizationCode: searchParams.get('organizationCode') ?? undefined,
    unitCode: searchParams.get('unitCode') ?? undefined,
  };

  return ok(await listActions(user, filters));
}
