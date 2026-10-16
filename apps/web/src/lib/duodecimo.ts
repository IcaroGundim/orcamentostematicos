/**
 * Duodécimo dos Poderes e Instituições (aba `Receitas`; contrato, seção 6.9).
 *
 * A LDO do Acre fixa a participação de cada Poder numa "receita líquida" (Lei nº
 * 4.627/2025, art. 35, e Anexo III, para 2026; a Lei nº 4.380/2024, art. 27, tem a
 * mesma regra para 2025):
 *
 *   (a) receita = ICMS + IPVA + ITCMD + taxas administrativas + FPE + IRRF +
 *                 IPI-exportação + ICMS-desoneração (LC 87/1996)
 *   (b) deduções = municípios (25% ICMS + 50% IPVA + 25% IPI-exportação)
 *                + PASEP (1% do FPE)
 *                + educação 30% e saúde 12% de (a − municípios)
 *   (c) receita líquida = (a) − (b);  cada Poder = (c) × percentual
 *
 * A base de educação e saúde não está escrita no Anexo III. Ela foi conferida contra
 * a LOA 2026: com a previsão do portal, esta leitura dá R$ 6.042,86 mi de receita
 * líquida, e a dotação de fonte 100 dos cinco Poderes no QDD implica R$ 6.042,98 mi
 * — a mesma nos cinco (ALEAC 6,26% = R$ 378,29 mi, no centavo). As outras leituras
 * (sobre (a), ou sem as taxas) erram por dezenas de milhões.
 *
 * Funções puras sobre as linhas de `summarizeRevenue`: valores **brutos** do mês (a
 * dedução do FUNDEB do portal não entra; a regra já desconta educação e saúde).
 */

import type { RevenueRow } from './revenue';

export interface DuodecimoBranch {
  key: string;
  label: string;
  /** Órgão no QDD: liga o percentual à dotação da LOA. */
  organizationCode: string;
  /** Participação na receita líquida, em %. */
  percent: number;
}

export interface DuodecimoRule {
  year: number;
  /** Lei e artigo da LDO, como a tela cita. */
  law: string;
  branches: DuodecimoBranch[];
}

/** Os mesmos percentuais em 2025 e 2026; manter a ordem do Anexo III. */
const BRANCHES_2025_2026: DuodecimoBranch[] = [
  { key: 'ALEAC', label: 'Assembleia Legislativa', organizationCode: '101', percent: 6.26 },
  { key: 'DPE', label: 'Defensoria Pública', organizationCode: '305', percent: 1.5 },
  { key: 'MPAC', label: 'Ministério Público', organizationCode: '304', percent: 5 },
  { key: 'TCE', label: 'Tribunal de Contas', organizationCode: '102', percent: 2.3 },
  { key: 'TJAC', label: 'Tribunal de Justiça', organizationCode: '203', percent: 9.75 },
];

/**
 * Catálogo manual (contrato, seção 12): uma regra por LDO. Exercício sem entrada
 * não mostra o bloco — percentual de outro ano seria um número errado com cara de
 * certo.
 */
export const DUODECIMO_RULES: Readonly<Record<number, DuodecimoRule>> = Object.freeze({
  2025: { year: 2025, law: 'Lei nº 4.380/2024 (LDO 2025), art. 27', branches: BRANCHES_2025_2026 },
  2026: { year: 2026, law: 'Lei nº 4.627/2025 (LDO 2026), art. 35', branches: BRANCHES_2025_2026 },
});

/** Órgãos de todos os Poderes do catálogo, para a página somar a dotação. */
export const DUODECIMO_ORGANIZATION_CODES: readonly string[] = [
  ...new Set(Object.values(DUODECIMO_RULES).flatMap((rule) => rule.branches.map((b) => b.organizationCode))),
];

/** Categorias de receita (`REVENUE_CATEGORIES`) que formam a base (a). */
export const DUODECIMO_BASE_CATEGORIES = [
  'ICMS',
  'IPVA',
  'ITCMD',
  'TAXAS_TESOURO',
  'FPE',
  'IRRF',
  'IPI_EXPORTACAO',
  'LC87',
] as const;

export const MUNICIPAL_SHARES = { ICMS: 0.25, IPVA: 0.5, IPI_EXPORTACAO: 0.25 } as const;
export const PASEP_RATE = 0.01;
export const EDUCATION_RATE = 0.3;
export const HEALTH_RATE = 0.12;

/** Uma coluna da base: o cálculo do Anexo III para um mês (ou para o ano). */
export interface DuodecimoBase {
  /** (a) Receita da base, bruta. */
  revenue: number;
  municipalities: number;
  pasep: number;
  education: number;
  health: number;
  /** (c) Receita líquida. */
  netRevenue: number;
}

/** Anexo III sobre os brutos de um período, por categoria. */
export function duodecimoBaseOf(gross: Partial<Record<string, number>>): DuodecimoBase {
  const value = (key: string) => gross[key] ?? 0;
  const revenue = DUODECIMO_BASE_CATEGORIES.reduce((total, key) => total + value(key), 0);
  const municipalities =
    MUNICIPAL_SHARES.ICMS * value('ICMS') +
    MUNICIPAL_SHARES.IPVA * value('IPVA') +
    MUNICIPAL_SHARES.IPI_EXPORTACAO * value('IPI_EXPORTACAO');
  const pasep = PASEP_RATE * value('FPE');
  const education = EDUCATION_RATE * (revenue - municipalities);
  const health = HEALTH_RATE * (revenue - municipalities);
  return {
    revenue,
    municipalities,
    pasep,
    education,
    health,
    netRevenue: revenue - municipalities - pasep - education - health,
  };
}

export interface DuodecimoBranchSummary extends DuodecimoBranch {
  /** Gerado pela arrecadação de cada mês (índice 0 = janeiro). */
  dueByMonth: number[];
  /** Soma do gerado nos meses fechados. */
  dueClosed: number;
  /** Dotação inicial na fonte 100 (LOA); `null` sem QDD do mesmo exercício. */
  appropriation: number | null;
  /**
   * Dotação atualizada na fonte 100: o orçamento disponibilizado ao Poder, com os
   * créditos suplementares. `null` sem QDD do mesmo exercício.
   */
  updatedAppropriation: number | null;
  /**
   * Duodécimo: dotação **atualizada** ÷ 12 — o art. 168 da Constituição manda
   * entregar em duodécimos as dotações "compreendidos os créditos suplementares e
   * especiais".
   */
  monthlyInstallment: number | null;
  /** Duodécimos dos meses fechados. */
  installmentsClosed: number | null;
  /**
   * Percentual efetivo: duodécimos dos meses fechados ÷ receita líquida realizada
   * nos mesmos meses, em %. É o quanto da receita o orçamento disponibilizado ao
   * Poder representa, se o Tesouro repassar o duodécimo — comparável ao `percent`
   * da LDO. `null` sem QDD ou sem receita líquida no período.
   */
  effectivePercent: number | null;
}

export interface DuodecimoSummary {
  rule: DuodecimoRule;
  /** Meses com arrecadação, e os fechados (sem o mês em curso). */
  months: number[];
  closedMonths: number[];
  /** Base de cada mês (índice 0 = janeiro). */
  baseByMonth: DuodecimoBase[];
  /** Base somada nos meses fechados. */
  baseClosed: DuodecimoBase;
  branches: DuodecimoBranchSummary[];
  /** Soma dos percentuais (24,81% em 2026). */
  totalPercent: number;
  /** Percentual efetivo de todos os Poderes juntos (mesma conta de `effectivePercent`). */
  totalEffectivePercent: number | null;
  /** Percentual efetivo de cada mês, somando os Poderes (índice 0 = janeiro); mês em curso, `null`. */
  effectivePercentByMonth: Array<number | null>;
  /**
   * Receita líquida que a LOA usou, deduzida das dotações: Σ dotações ÷ Σ
   * percentuais. `null` sem QDD do mesmo exercício.
   */
  impliedNetForecast: number | null;
}

/** `value ÷ base` em %; `null` sem valor ou com base não positiva (mês sem arrecadação). */
function shareOrNull(value: number | null, base: number): number | null {
  return value == null || !(base > 0) ? null : (value / base) * 100;
}

/**
 * Resumo do duodécimo de um exercício. `rows` são as linhas de `summarizeRevenue`;
 * `appropriations` é a dotação de fonte 100 por órgão (de
 * `treasuryAppropriationByOrganization`), só quando o QDD carregado é do mesmo ano.
 * Sem regra para o ano, `null`.
 */
export function summarizeDuodecimo(
  year: number,
  rows: Pick<RevenueRow, 'key' | 'gross'>[],
  months: number[],
  partialMonth: number | null,
  appropriations: Record<string, { initialBudget: number; updatedBudget?: number }> | null,
): DuodecimoSummary | null {
  const rule = DUODECIMO_RULES[year];
  if (!rule) return null;

  const grossOf = (key: string) => rows.find((row) => row.key === key)?.gross ?? [];
  const baseByMonth = Array.from({ length: 12 }, (_, index) =>
    duodecimoBaseOf(
      Object.fromEntries(DUODECIMO_BASE_CATEGORIES.map((key) => [key, grossOf(key)[index] ?? 0])),
    ),
  );
  const closedMonths = months.filter((month) => month !== partialMonth);
  const baseClosed = closedMonths.reduce<DuodecimoBase>(
    (total, month) => {
      const base = baseByMonth[month - 1]!;
      return {
        revenue: total.revenue + base.revenue,
        municipalities: total.municipalities + base.municipalities,
        pasep: total.pasep + base.pasep,
        education: total.education + base.education,
        health: total.health + base.health,
        netRevenue: total.netRevenue + base.netRevenue,
      };
    },
    { revenue: 0, municipalities: 0, pasep: 0, education: 0, health: 0, netRevenue: 0 },
  );

  const branches = rule.branches.map((branch) => {
    const dueByMonth = baseByMonth.map((base) => (base.netRevenue * branch.percent) / 100);
    const entry = appropriations?.[branch.organizationCode];
    const appropriation = appropriations ? (entry?.initialBudget ?? 0) : null;
    // Sem a atualizada (chamador antigo), vale a inicial.
    const updatedAppropriation = appropriations ? (entry?.updatedBudget ?? entry?.initialBudget ?? 0) : null;
    // Aproximação: o ano inteiro da atualizada, rateado em 12. Um crédito aberto em
    // setembro entra também nos meses anteriores; é o orçamento do ano que se compara.
    const monthlyInstallment = updatedAppropriation == null ? null : updatedAppropriation / 12;
    const installmentsClosed = monthlyInstallment == null ? null : monthlyInstallment * closedMonths.length;
    return {
      ...branch,
      dueByMonth,
      dueClosed: closedMonths.reduce((total, month) => total + dueByMonth[month - 1]!, 0),
      appropriation,
      updatedAppropriation,
      monthlyInstallment,
      installmentsClosed,
      effectivePercent: shareOrNull(installmentsClosed, baseClosed.netRevenue),
    };
  });

  const totalPercent = rule.branches.reduce((total, branch) => total + branch.percent, 0);
  const appropriationTotal = branches.reduce((total, branch) => total + (branch.appropriation ?? 0), 0);
  const updatedTotal = branches.reduce((total, branch) => total + (branch.updatedAppropriation ?? 0), 0);
  const monthlyTotal = appropriations ? updatedTotal / 12 : null;
  return {
    rule,
    months,
    closedMonths,
    baseByMonth,
    baseClosed,
    branches,
    totalPercent,
    totalEffectivePercent: shareOrNull(
      monthlyTotal == null ? null : monthlyTotal * closedMonths.length,
      baseClosed.netRevenue,
    ),
    // O mês em curso ainda arrecada: comparar o duodécimo inteiro com meio mês de receita
    // daria um percentual sem sentido.
    effectivePercentByMonth: baseByMonth.map((base, index) =>
      index + 1 === partialMonth ? null : shareOrNull(monthlyTotal, base.netRevenue),
    ),
    // A conferência contra a LOA usa a inicial: é ela que a lei fixou pelos percentuais.
    impliedNetForecast:
      appropriations && appropriationTotal > 0 ? appropriationTotal / (totalPercent / 100) : null,
  };
}
