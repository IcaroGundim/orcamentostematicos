import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { summarizeRevenue, type RevenueDto } from '@/lib/revenue';

/** Ano e mês correntes em Rio Branco, para marcar o mês ainda em arrecadação. */
function currentYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Rio_Branco',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick('year'), month: pick('month') };
}

/**
 * GET /api/revenue
 *
 * Receitas de **todos** os anos coletados (série histórica desde 2016 + o ano
 * corrente), por categoria e mês, gravadas pelo job semanal
 * `scripts/collect-revenue.mjs`. Só agregados; restrita à SEPLAN, como a folha.
 *
 * Não segue o exercício do painel: a receita tem o próprio seletor de ano na aba, e
 * trocar o ano não pode disparar requisição (contrato, R2) — por isso vêm todos de
 * uma vez (~2 mil linhas no banco, um resumo pequeno por ano). Ordem: ano desc.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const lines = await prisma.revenueMonth.findMany({ orderBy: [{ year: 'desc' }, { month: 'asc' }] });
  const byYear = new Map<number, typeof lines>();
  for (const line of lines) {
    const list = byYear.get(line.year) ?? [];
    list.push(line);
    byYear.set(line.year, list);
  }

  const now = currentYearMonth();
  const summaries: RevenueDto[] = [...byYear].map(([year, records]) => {
    const summary = summarizeRevenue(year, records);
    const lastMonth = summary.months.at(-1) ?? null;
    const collectedAt = records.reduce(
      (latest, record) => (record.collectedAt > latest ? record.collectedAt : latest),
      records[0].collectedAt,
    );
    return {
      ...summary,
      collectedAt: collectedAt.toISOString(),
      partialMonth: year === now.year && lastMonth === now.month ? lastMonth : null,
    };
  });
  return ok({ summaries });
}
