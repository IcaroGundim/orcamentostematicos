import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/payroll
 *
 * Agregados da folha de pagamento do mês mais recente coletado do Portal da
 * Transparência. Só devolve somas — nenhum dado pessoal é armazenado nem servido.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const snapshot = await prisma.payrollSnapshot.findFirst({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { groups: true },
  });

  if (!snapshot) {
    return ok({ snapshot: null, byContractType: [], byOrganization: [], byCareer: [], byOrganizationContract: [] });
  }

  const of = (dimension: string) =>
    snapshot.groups
      .filter((group) => group.dimension === dimension)
      .map((group) => ({
        key: group.key,
        secondaryKey: group.secondaryKey,
        headcount: group.headcount,
        grossTotal: group.grossTotal,
        deductionsTotal: group.deductionsTotal,
        netTotal: group.netTotal,
      }))
      .sort((a, b) => b.grossTotal - a.grossTotal);

  return ok({
    snapshot: {
      year: snapshot.year,
      month: snapshot.month,
      collectedAt: snapshot.collectedAt,
      headcount: snapshot.headcount,
      portalHeadcount: snapshot.portalHeadcount,
      grossTotal: snapshot.grossTotal,
      deductionsTotal: snapshot.deductionsTotal,
      netTotal: snapshot.netTotal,
    },
    byContractType: of('CONTRACT_TYPE'),
    byOrganization: of('ORGANIZATION'),
    byCareer: of('CAREER'),
    byOrganizationContract: of('ORGANIZATION_CONTRACT'),
  });
}
