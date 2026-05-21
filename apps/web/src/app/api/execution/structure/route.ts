import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { listGovernmentStructure } from '@/lib/government-structure';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/execution/structure
 *
 * Árvore do cadastro de estrutura de governo + executor atual por unidade.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const [catalog, mappings] = await Promise.all([
    listGovernmentStructure(),
    prisma.unitExecutor.findMany({
      select: { organizationCode: true, unitCode: true, executorUnitCode: true },
    }),
  ]);

  const executorByPair = new Map<string, string | null>();
  for (const m of mappings) {
    executorByPair.set(`${m.organizationCode}|${m.unitCode}`, m.executorUnitCode);
  }

  const organizations = catalog.organizations.map((org) => ({
    code: org.code,
    name: org.name,
    units: org.units.map((unit) => ({
      organizationCode: org.code,
      organizationName: org.name,
      unitCode: unit.code,
      unitName: unit.name,
      executorUnitCode: executorByPair.get(`${org.code}|${unit.code}`) ?? null,
    })),
  }));

  return ok({ organizations });
}
