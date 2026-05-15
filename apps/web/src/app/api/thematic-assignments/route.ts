import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden, badRequest } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapAssignment } from '@/lib/store';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const rows = await prisma.thematicAssignment.findMany();
  return ok(rows.map(mapAssignment));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.actionId || !body?.theme || !body?.axis || !body?.classification) {
    return badRequest('actionId, theme, axis e classification são obrigatórios.');
  }

  const row = await prisma.thematicAssignment.create({
    data: {
      actionId: body.actionId,
      theme: body.theme,
      axis: body.axis,
      classification: body.classification,
      weightingFactor: body.weightingFactor ?? null,
      justification: body.justification ?? null,
      status: body.status ?? 'PRONTO_PARA_VALIDACAO',
      createdBy: user.id,
    },
  });
  return ok(mapAssignment(row));
}
