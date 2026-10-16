import { describe, expect, it } from 'vitest';
import {
  aggregateRevenue,
  bucketRevenue,
  classifyRevenue,
  compareSamePeriod,
  selectedGroupNet,
  summarizeRevenue,
  type RevenueMonthRows,
} from './revenue';

describe('classifyRevenue', () => {
  it('reconhece os tributos pela natureza, com qualquer tipo (principal, multas, dívida ativa)', () => {
    expect(classifyRevenue('111450110000', 2026).key).toBe('ICMS');
    expect(classifyRevenue('111450130000', 2026).key).toBe('ICMS');
    expect(classifyRevenue('111251010000', 2026).key).toBe('IPVA');
    expect(classifyRevenue('111252010000', 2026).key).toBe('ITCMD');
    expect(classifyRevenue('111303110000', 2026).key).toBe('IRRF');
    expect(classifyRevenue('112201010000', 2026).key).toBe('TAXAS');
    expect(classifyRevenue(171150010000, 2026).key).toBe('FPE');
    expect(classifyRevenue('175150010000', 2026).key).toBe('FUNDEB');
  });

  it('usa a estrutura da natureza em vigor no exercício', () => {
    // 2018–2021
    expect(classifyRevenue('111802110000', 2019).key).toBe('ICMS');
    expect(classifyRevenue('111801210000', 2019).key).toBe('IPVA');
    expect(classifyRevenue('111801310000', 2019).key).toBe('ITCMD');
    expect(classifyRevenue('171801110000', 2020).key).toBe('FPE');
    expect(classifyRevenue('971801110000', 2020)).toEqual({ key: 'FPE', deduction: true });
    expect(classifyRevenue('175801110000', 2021).key).toBe('FUNDEB');
    // até 2017: o mesmo 11130200 que hoje seria IRRF era o ICMS
    expect(classifyRevenue('11130200', 2016).key).toBe('ICMS');
    expect(classifyRevenue('11130200', 2026).key).toBe('IRRF');
    expect(classifyRevenue('193115000000', 2017).key).toBe('ICMS');
    expect(classifyRevenue('111204310000', 2017).key).toBe('IRRF');
    expect(classifyRevenue('172101010000', 2016).key).toBe('FPE');
    expect(classifyRevenue('172401010000', 2016).key).toBe('FUNDEB');
  });

  it('leva a dedução (9…) ao tributo de origem', () => {
    expect(classifyRevenue('911450110000', 2026)).toEqual({ key: 'ICMS', deduction: true });
    expect(classifyRevenue('971150010000', 2026)).toEqual({ key: 'FPE', deduction: true });
  });

  it('separa as intraorçamentárias e não descarta código desconhecido', () => {
    expect(classifyRevenue('721502110000', 2026).key).toBe('INTRA');
    expect(classifyRevenue('199999010000', 2026).key).toBe('OUTRAS_CORRENTES');
    expect(classifyRevenue('299999010000', 2026).key).toBe('OUTRAS_CAPITAL');
    expect(classifyRevenue(null, 2026).key).toBe('OUTRAS_CAPITAL');
  });
});

describe('aggregateRevenue', () => {
  const months: RevenueMonthRows[] = [
    {
      month: 1,
      rows: [
        { codigoreceita: '111450110000', arrecadado: '100.00', previsto: '1200', previstoatualizado: '1200' },
        { codigoreceita: '911450110000', arrecadado: '-20.00', previsto: '-240', previstoatualizado: '-240' },
        { codigoreceita: '171150010000', arrecadado: '300', previsto: '3600', previstoatualizado: '3600' },
      ],
    },
    {
      month: 2,
      rows: [
        { codigoreceita: '111450110000', arrecadado: '50', previsto: '1200', previstoatualizado: '1300' },
        { codigoreceita: '911450110000', arrecadado: '-10', previsto: '-240', previstoatualizado: '-260' },
        { codigoreceita: '171150010000', arrecadado: 'lixo', previsto: '3600', previstoatualizado: '3600' },
      ],
    },
  ];

  it('soma o líquido do tributo e fecha com o total das linhas', () => {
    const summary = aggregateRevenue(2026, months);
    const icms = summary.rows.find((row) => row.key === 'ICMS')!;
    expect(icms.gross.slice(0, 2)).toEqual([100, 50]);
    expect(icms.deductions.slice(0, 2)).toEqual([-20, -10]);
    expect(icms.netTotal).toBe(120);
    expect(summary.monthlyNet.slice(0, 2)).toEqual([380, 40]);
    expect(summary.netTotal).toBe(420);
    expect(summary.grossTotal + summary.deductionsTotal).toBe(summary.netTotal);
  });

  it('subtotais por grupo fecham com o total, mês a mês', () => {
    const summary = aggregateRevenue(2026, months);
    expect(summary.groups.map((group) => group.group)).toEqual(['tributaria', 'transferencias']);
    const tributaria = summary.groups[0];
    expect(tributaria.net.slice(0, 2)).toEqual([80, 40]);
    expect(tributaria.updatedForecast).toBe(1040);
    for (let index = 0; index < 12; index++) {
      const monthTotal = summary.groups.reduce((total, group) => total + group.net[index], 0);
      expect(monthTotal).toBeCloseTo(summary.monthlyNet[index], 6);
    }
    expect(summary.groups.reduce((total, group) => total + group.netTotal, 0)).toBe(summary.netTotal);
  });

  it('o resumo lido do banco é o mesmo das linhas do portal', () => {
    const fromPortal = aggregateRevenue(2026, months);
    const fromDatabase = summarizeRevenue(2026, bucketRevenue(2026, months).reverse());
    expect(fromDatabase).toEqual(fromPortal);
  });

  it('categoria que saiu do catálogo cai em "Outras receitas correntes" sem sumir do total', () => {
    const summary = summarizeRevenue(2026, [
      { month: 1, category: 'ICMS', gross: 10, deductions: -2, forecast: 100, updatedForecast: 100 },
      { month: 1, category: 'CATEGORIA_ANTIGA', gross: 5, deductions: 0, forecast: 0, updatedForecast: 0 },
    ]);
    expect(summary.rows.find((row) => row.key === 'OUTRAS_CORRENTES')?.netTotal).toBe(5);
    expect(summary.netTotal).toBe(13);
  });

  it('usa a previsão do último mês, líquida das deduções', () => {
    const summary = aggregateRevenue(2026, [...months].reverse());
    const icms = summary.rows.find((row) => row.key === 'ICMS')!;
    expect(icms.forecast).toBe(960);
    expect(icms.updatedForecast).toBe(1040);
    expect(summary.months).toEqual([1, 2]);
  });
});

describe('compareSamePeriod', () => {
  const monthly = (values: number[]) => [...values, ...Array(12 - values.length).fill(0)];
  it('compara só os meses fechados com os mesmos meses do ano anterior', () => {
    const result = compareSamePeriod(
      { months: [1, 2, 3], partialMonth: 3, monthlyNet: monthly([110, 120, 5]) },
      { monthlyNet: monthly([100, 100, 100, 100]) },
    );
    expect(result?.months).toEqual([1, 2]);
    expect(result?.currentNet).toBe(230);
    expect(result?.previousNet).toBe(200);
    expect(result?.change).toBeCloseTo(15, 6);
  });

  it('sem ano anterior não compara', () => {
    expect(compareSamePeriod({ months: [1], partialMonth: null, monthlyNet: monthly([1]) }, undefined)).toBeNull();
  });
});

describe('selectedGroupNet', () => {
  const summary = aggregateRevenue(2026, [
    {
      month: 1,
      rows: [
        { codigoreceita: '111450110000', arrecadado: '100' },
        { codigoreceita: '911450110000', arrecadado: '-20' },
        { codigoreceita: '111251010000', arrecadado: '30' },
        { codigoreceita: '171150010000', arrecadado: '300' },
      ],
    },
  ]);

  it('com tudo marcado, fecha com os grupos do resumo', () => {
    const all = new Set(summary.rows.map((row) => row.key));
    expect(selectedGroupNet(summary.rows, all).map((group) => group.net)).toEqual(
      summary.groups.map((group) => group.net),
    );
  });

  it('soma só as categorias marcadas e omite grupo sem nenhuma', () => {
    const result = selectedGroupNet(summary.rows, new Set(['ICMS']));
    expect(result.map((group) => group.group)).toEqual(['tributaria']);
    expect(result[0].net[0]).toBe(80);
  });
});
