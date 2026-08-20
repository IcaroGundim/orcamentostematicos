import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { getCurrentYear, listExercises } from '@/lib/store';

/**
 * GET /api/exercises — exercícios disponíveis (todo ano com QDD vigente).
 * Exercícios apenas comparativos são exclusivos da SEPLAN.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const [exercises, currentYear] = await Promise.all([listExercises(), getCurrentYear()]);
  const visible =
    user.role === 'SEPLAN_ADMIN' ? exercises : exercises.filter((e) => !e.comparisonOnly);

  return ok({
    currentYear,
    exercises: visible.map((e) => ({
      year: e.year,
      comparisonOnly: e.comparisonOnly,
      isCurrent: e.isCurrent,
    })),
  });
}
