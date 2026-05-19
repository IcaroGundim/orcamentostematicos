import { NextRequest } from 'next/server';
import { getAuthUser, ok, unauthorized, forbidden } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { mapCycle } from '@/lib/store';

const VALIDATION_STATUSES = ['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'] as const;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  const rows = await prisma.validationCycle.findMany({
    orderBy: { openedAt: 'desc' },
    include: { validations: { select: { status: true } } },
  });
  return ok(rows.map((row) => ({
    ...mapCycle(row),
    validationCount: row.validations.length,
    validationsByStatus: VALIDATION_STATUSES.map((status) => ({
      status,
      count: row.validations.filter((v) => v.status === status).length,
    })),
  })));
}

/**
 * Abertura manual de ciclo foi descontinuada: os ciclos agora são implícitos e
 * criados automaticamente na classificação temática. Mantido apenas para
 * recusar chamadas antigas explicitamente.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  return forbidden();
}
