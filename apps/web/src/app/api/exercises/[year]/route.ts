import { NextRequest } from 'next/server';
import { badRequest, conflict, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { getCurrentYear, setCurrentYear } from '@/lib/store';

/**
 * PATCH /api/exercises/[year] — política do exercício.
 *
 * Body: { comparisonOnly?: boolean, isCurrent?: true }
 *
 * `comparisonOnly` nasce na primeira importação do ano; esta rota é a única forma
 * deliberada de mudá-la. `isCurrent` só pode ser LIGADO: desligar sem ligar outro
 * faria o corrente saltar em silêncio para o ano mais recente do fallback.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { year: rawYear } = await params;
  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return badRequest('Exercício inválido.');

  const body = await req.json().catch(() => null);
  const wantsComparison = typeof body?.comparisonOnly === 'boolean' ? body.comparisonOnly : null;
  const wantsCurrent = body?.isCurrent === true;
  if (body?.isCurrent === false) {
    return badRequest('Para trocar o exercício corrente, marque outro — não é possível apenas desmarcar.');
  }
  if (wantsComparison == null && !wantsCurrent) {
    return badRequest('Informe comparisonOnly ou isCurrent.');
  }

  const hasImport = await prisma.budgetImport.findFirst({ where: { year }, select: { id: true } });
  if (!hasImport) return badRequest(`Nenhuma importação de QDD para o exercício ${year}.`);

  const [existing, currentYear] = await Promise.all([
    prisma.fiscalYear.findUnique({ where: { year }, select: { comparisonOnly: true } }),
    getCurrentYear(),
  ]);
  const comparisonAfter = wantsComparison ?? existing?.comparisonOnly ?? false;
  const currentAfter = wantsCurrent || currentYear === year;

  // Corrente e comparativo se excluem: um exercício comparativo não tem ciclos nem
  // entregas, então apontar as entregas para ele deixaria as secretarias sem nada
  // para preencher e sem explicação.
  if (comparisonAfter && currentAfter) {
    return conflict(
      wantsCurrent
        ? `O exercício ${year} é apenas comparativo e não pode ser o corrente. Desmarque "apenas comparação" antes.`
        : `O exercício ${year} é o corrente e não pode ser marcado como apenas comparativo. Torne outro exercício corrente antes.`,
    );
  }

  if (wantsComparison != null) {
    await prisma.fiscalYear.upsert({
      where: { year },
      create: { year, comparisonOnly: wantsComparison },
      update: { comparisonOnly: wantsComparison },
    });
  }
  if (wantsCurrent) await setCurrentYear(year);

  const row = await prisma.fiscalYear.findUnique({ where: { year } });
  return ok({
    year,
    comparisonOnly: row?.comparisonOnly ?? false,
    isCurrent: row?.isCurrent ?? false,
  });
}
