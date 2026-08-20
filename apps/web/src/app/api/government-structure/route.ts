import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { resolveRequestYear } from '@/lib/exercise-request';
import { listGovernmentStructure } from '@/lib/government-structure';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const exercise = await resolveRequestYear(req, user);
  if (exercise.response) return exercise.response;

  return ok(await listGovernmentStructure(exercise.year));
}
