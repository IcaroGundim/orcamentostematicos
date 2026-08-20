import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { getSummary } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  return ok(await getSummary(user, exercise.year));
}
