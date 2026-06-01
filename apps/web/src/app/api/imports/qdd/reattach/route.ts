import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { reattachOrphanAssignmentsToVigente } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const result = await reattachOrphanAssignmentsToVigente();
  return ok({ reattachedAssignments: result.reattached, unmatchedAssignments: result.unmatched });
}
