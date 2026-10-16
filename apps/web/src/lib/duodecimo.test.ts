import { describe, expect, it } from 'vitest';
import { duodecimoBaseOf, summarizeDuodecimo } from './duodecimo';
import { treasuryAppropriationByOrganization } from './execution-monitor';
import { classifyRevenue } from './revenue';
import type { BudgetAction } from '@/types/domain';

/**
 * Previsão de 2026 no Portal da Transparência (soma de `previsto` por categoria, só
 * linhas brutas; consultado em 2026-10-16) e dotação inicial de fonte 100 dos cinco
 * Poderes no QDD de maio/2026.
 */
const FORECAST_2026 = {
  ICMS: 2_228_800_000.01,
  IPVA: 145_300_000,
  ITCMD: 10_500_000,
  TAXAS_TESOURO: 290_000,
  FPE: 8_008_109_606,
  IRRF: 792_300_000,
  IPI_EXPORTACAO: 1_789_308,
  LC87: 1_000,
};
const LOA_2026 = { '101': 378_290_510.72, '102': 138_988_526.3, '203': 589_190_491.93, '304': 302_148_970.22, '305': 90_644_691.07 };

describe('duodecimoBaseOf (Anexo III da LDO 2026)', () => {
  it('reproduz a receita líquida que a LOA 2026 usou para os Poderes', () => {
    const base = duodecimoBaseOf(FORECAST_2026);
    // Σ dotações ÷ 24,81%: a receita líquida implícita na LOA.
    const implied = Object.values(LOA_2026).reduce((total, value) => total + value, 0) / 0.2481;
    expect(implied).toBeCloseTo(6_042_979_404.4, 0);
    // 0,002% de diferença: arredondamentos da proposta, não a regra.
    expect(Math.abs(base.netRevenue - implied) / implied).toBeLessThan(0.00003);
  });

  it('municípios: 25% do ICMS, 50% do IPVA e 25% do IPI; PASEP 1% do FPE', () => {
    const base = duodecimoBaseOf({ ICMS: 100, IPVA: 100, IPI_EXPORTACAO: 100, FPE: 100 });
    expect(base.revenue).toBe(400);
    expect(base.municipalities).toBe(100);
    expect(base.pasep).toBe(1);
    expect(base.education).toBeCloseTo(90, 9);
    expect(base.health).toBeCloseTo(36, 9);
    expect(base.netRevenue).toBeCloseTo(400 - 100 - 1 - 90 - 36, 9);
  });

  it('categoria fora da base não entra', () => {
    expect(duodecimoBaseOf({ FUNDEB: 1_000, TAXAS: 1_000, SUS: 1_000 }).revenue).toBe(0);
  });
});

describe('summarizeDuodecimo', () => {
  const gross = (value: number) => Array.from({ length: 12 }, (_, index) => (index < 3 ? value : 0));
  const rows = [
    { key: 'ICMS', gross: gross(400) },
    { key: 'FPE', gross: gross(600) },
  ];

  it('só meses fechados entram no acumulado; o mês em curso fica de fora', () => {
    const summary = summarizeDuodecimo(2026, rows, [1, 2, 3], 3, null)!;
    expect(summary.closedMonths).toEqual([1, 2]);
    const aleac = summary.branches.find((branch) => branch.key === 'ALEAC')!;
    const monthNet = duodecimoBaseOf({ ICMS: 400, FPE: 600 }).netRevenue;
    expect(aleac.dueClosed).toBeCloseTo(2 * monthNet * 0.0626, 9);
    expect(aleac.appropriation).toBeNull();
    expect(summary.impliedNetForecast).toBeNull();
  });

  it('com a LOA: duodécimo = dotação ÷ 12 e receita líquida implícita', () => {
    const appropriations = Object.fromEntries(
      Object.entries(LOA_2026).map(([code, initialBudget]) => [code, { initialBudget }]),
    );
    const summary = summarizeDuodecimo(2026, rows, [1, 2, 3], null, appropriations)!;
    const tjac = summary.branches.find((branch) => branch.key === 'TJAC')!;
    expect(tjac.monthlyInstallment).toBeCloseTo(589_190_491.93 / 12, 6);
    expect(tjac.installmentsClosed).toBeCloseTo((589_190_491.93 / 12) * 3, 6);
    expect(summary.totalPercent).toBeCloseTo(24.81, 9);
    expect(summary.impliedNetForecast).toBeCloseTo(6_042_979_404.4, 0);
  });

  it('% efetivo: duodécimos dos meses fechados ÷ receita líquida dos mesmos meses', () => {
    const appropriations = { '101': { initialBudget: 1_200 }, '203': { initialBudget: 2_400 } };
    const summary = summarizeDuodecimo(2026, rows, [1, 2, 3], 3, appropriations)!;
    const monthNet = duodecimoBaseOf({ ICMS: 400, FPE: 600 }).netRevenue;
    const aleac = summary.branches.find((branch) => branch.key === 'ALEAC')!;
    // Dois meses fechados × R$ 100 de duodécimo, sobre dois meses de receita líquida.
    expect(aleac.effectivePercent).toBeCloseTo((200 / (2 * monthNet)) * 100, 9);
    expect(summary.totalEffectivePercent).toBeCloseTo((600 / (2 * monthNet)) * 100, 9);
    expect(summary.effectivePercentByMonth[0]).toBeCloseTo((300 / monthNet) * 100, 9);
    // Mês em curso (3) fica sem percentual: duodécimo inteiro sobre meio mês de receita.
    expect(summary.effectivePercentByMonth[2]).toBeNull();
    // Mês sem arrecadação não vira divisão por zero.
    expect(summary.effectivePercentByMonth[5]).toBeNull();
    // Órgão sem dotação no QDD: 0%, não "–" — a falta é do dado, e aparece.
    expect(summary.branches.find((branch) => branch.key === 'DPE')!.effectivePercent).toBe(0);
  });

  it('duodécimo sobre a dotação atualizada (créditos suplementares); LOA implícita pela inicial', () => {
    const appropriations = { '101': { initialBudget: 1_200, updatedBudget: 2_400 } };
    const summary = summarizeDuodecimo(2026, rows, [1, 2], null, appropriations)!;
    const aleac = summary.branches.find((branch) => branch.key === 'ALEAC')!;
    expect(aleac.appropriation).toBe(1_200);
    expect(aleac.updatedAppropriation).toBe(2_400);
    expect(aleac.monthlyInstallment).toBe(200);
    expect(aleac.installmentsClosed).toBe(400);
    expect(summary.impliedNetForecast).toBeCloseTo(1_200 / 0.2481, 6);
  });

  it('sem LOA, sem % efetivo', () => {
    const summary = summarizeDuodecimo(2026, rows, [1, 2], null, null)!;
    expect(summary.totalEffectivePercent).toBeNull();
    expect(summary.branches.every((branch) => branch.effectivePercent == null)).toBe(true);
    expect(summary.effectivePercentByMonth.every((value) => value == null)).toBe(true);
  });

  it('exercício sem LDO no catálogo não tem duodécimo', () => {
    expect(summarizeDuodecimo(2024, rows, [1], null, null)).toBeNull();
  });
});

describe('classificação usada pela base', () => {
  it('separa IPI-exportação, LC 87 e as taxas do Tesouro', () => {
    expect(classifyRevenue('171153010100', 2026).key).toBe('IPI_EXPORTACAO');
    expect(classifyRevenue('171951010100', 2026).key).toBe('LC87');
    expect(classifyRevenue('112201010100', 2026, '15000100').key).toBe('TAXAS_TESOURO');
    expect(classifyRevenue('112201010300', 2026, '17530700').key).toBe('TAXAS');
    expect(classifyRevenue('112250010100', 2026).key).toBe('TAXAS');
  });
});

describe('treasuryAppropriationByOrganization', () => {
  it('soma só a fonte 100 dos órgãos pedidos; órgão sem linha volta com zero', () => {
    const line = (source: string, initialBudget: number) => ({ source, initialBudget, updatedBudget: initialBudget * 2 });
    const actions = [
      { organizationCode: '101', expenseLines: [line('15000100', 10), line('15010100', 99)] },
      { organizationCode: '999', expenseLines: [line('15000100', 50)] },
    ] as unknown as BudgetAction[];
    expect(treasuryAppropriationByOrganization(actions, ['101', '305'])).toEqual({
      '101': { initialBudget: 10, updatedBudget: 20 },
      '305': { initialBudget: 0, updatedBudget: 0 },
    });
  });
});
