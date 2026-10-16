/**
 * Receitas do Estado por tributo, mês a mês (aba `Receitas` de `/orcamento`).
 *
 * Funções puras sobre as linhas que o Portal da Transparência devolve em
 * `/receitas/listar` (uma consulta por mês). Sem I/O, sem `server-only` e sem
 * imports: o job `scripts/collect-revenue.mjs` importa este arquivo direto pelo
 * Node (remoção de tipos nativa, Node ≥ 22.18), então a classificação tem uma
 * implementação só — a mesma da rota que lê o banco.
 *
 * O código da receita segue a natureza de receita da STN nos oito primeiros dígitos,
 * numa estrutura que muda com o exercício ({@link revenueNatureEra}); na atual,
 * `C.O.E.D.DD.D.T` — categoria, origem, espécie, desdobramentos e tipo (1
 * principal, 2 multas e juros, 3 dívida ativa, 4 multas da dívida ativa). Duas
 * convenções do portal, iguais em todas as estruturas, importam aqui:
 *
 * - **dedução** troca o primeiro dígito por 9 e mantém o resto: `91145011` é a
 *   dedução para o FUNDEB do ICMS `11145011`. Ela entra no tributo de origem, com
 *   sinal negativo, para que o líquido de cada tributo feche sozinho;
 * - **intraorçamentária** começa por 7 (corrente) ou 8 (capital): é dinheiro que
 *   circula entre órgãos do próprio Estado e fica num grupo separado.
 */

/** Linha crua de `/receitas/listar` (só os campos que usamos). */
export interface PortalRevenueRow {
  codigoreceita?: string | number | null;
  descricaoreceita?: string | null;
  previsto?: string | number | null;
  previstoatualizado?: string | number | null;
  arrecadado?: string | number | null;
}

/** Linhas de um mês: a consulta do portal é sempre de um mês por vez. */
export interface RevenueMonthRows {
  month: number;
  rows: PortalRevenueRow[];
}

export type RevenueGroup = 'tributaria' | 'transferencias' | 'demais';

/** Ordem de exibição dos grupos. */
export const REVENUE_GROUPS: RevenueGroup[] = ['tributaria', 'transferencias', 'demais'];

export const REVENUE_GROUP_LABELS: Record<RevenueGroup, string> = {
  tributaria: 'Receita tributária',
  transferencias: 'Transferências',
  demais: 'Demais receitas',
};

interface RevenueCategory {
  key: string;
  label: string;
  group: RevenueGroup;
}

/** Categorias na ordem de exibição (dentro de cada grupo). */
export const REVENUE_CATEGORIES: RevenueCategory[] = [
  { key: 'ICMS', label: 'ICMS', group: 'tributaria' },
  { key: 'IPVA', label: 'IPVA', group: 'tributaria' },
  { key: 'ITCMD', label: 'ITCMD', group: 'tributaria' },
  { key: 'IRRF', label: 'Imposto de renda retido (IRRF)', group: 'tributaria' },
  { key: 'TAXAS', label: 'Taxas', group: 'tributaria' },
  { key: 'OUTROS_TRIBUTOS', label: 'Outros tributos', group: 'tributaria' },
  { key: 'FPE', label: 'Cota-parte do FPE', group: 'transferencias' },
  { key: 'FUNDEB', label: 'FUNDEB', group: 'transferencias' },
  { key: 'SUS', label: 'Transferências do SUS', group: 'transferencias' },
  { key: 'ROYALTIES', label: 'Royalties e compensações', group: 'transferencias' },
  { key: 'OUTRAS_TRANSF', label: 'Outras transferências correntes', group: 'transferencias' },
  { key: 'TRANSF_CAPITAL', label: 'Transferências de capital', group: 'transferencias' },
  { key: 'CONTRIBUICOES', label: 'Contribuições', group: 'demais' },
  { key: 'PATRIMONIAL', label: 'Receita patrimonial', group: 'demais' },
  { key: 'SERVICOS', label: 'Receita de serviços', group: 'demais' },
  { key: 'OPERACOES_CREDITO', label: 'Operações de crédito', group: 'demais' },
  { key: 'INTRA', label: 'Intraorçamentárias', group: 'demais' },
  { key: 'OUTRAS_CORRENTES', label: 'Outras receitas correntes', group: 'demais' },
  { key: 'OUTRAS_CAPITAL', label: 'Outras receitas de capital', group: 'demais' },
];

/**
 * Estrutura da natureza de receita em vigor no exercício. A STN reorganizou os
 * códigos duas vezes no período do portal (conferido nos dados em 2026-10-15):
 *
 * - `antiga` (até 2017): ICMS `1113.02`, FPE `1721.01`, FUNDEB `1724`; multas e
 *   dívida ativa ficavam fora do imposto, em `19…`;
 * - `transicao` (2018–2021): ICMS `1118.02`, IPVA `1118.01.2`, FPE `1718.01.1`,
 *   FUNDEB `1758`;
 * - `atual` (2022 em diante, Portaria Conjunta STN/SOF 650/2019): ICMS `1114.50`,
 *   FPE `1711.50`, FUNDEB `175`.
 */
export type RevenueNatureEra = 'antiga' | 'transicao' | 'atual';

export function revenueNatureEra(year: number): RevenueNatureEra {
  if (year <= 2017) return 'antiga';
  if (year <= 2021) return 'transicao';
  return 'atual';
}

/** Prefixos genéricos, iguais nas três estruturas: valem depois dos específicos. */
const COMMON_PREFIXES: Array<[string, string]> = [
  ['112', 'TAXAS'],
  ['11', 'OUTROS_TRIBUTOS'],
  ['17', 'OUTRAS_TRANSF'],
  ['24', 'TRANSF_CAPITAL'],
  ['12', 'CONTRIBUICOES'],
  ['13', 'PATRIMONIAL'],
  ['16', 'SERVICOS'],
  ['21', 'OPERACOES_CREDITO'],
  ['7', 'INTRA'],
  ['8', 'INTRA'],
  ['1', 'OUTRAS_CORRENTES'],
  ['', 'OUTRAS_CAPITAL'],
];

/**
 * Catálogo manual (contrato, seção 12): prefixo da natureza (já sem a marca de
 * dedução) → categoria, por estrutura. Vence o primeiro que casar, então o
 * específico vem antes do genérico; o último prefixo é vazio — nenhuma linha é
 * descartada.
 */
export const REVENUE_NATURE_PREFIXES: Record<RevenueNatureEra, Array<[string, string]>> = {
  atual: [
    ['111450', 'ICMS'],
    ['111251', 'IPVA'],
    ['111252', 'ITCMD'],
    ['11130', 'IRRF'],
    ['171150', 'FPE'],
    ['175', 'FUNDEB'],
    ['1713', 'SUS'],
    ['1712', 'ROYALTIES'],
    ...COMMON_PREFIXES,
  ],
  transicao: [
    ['111802', 'ICMS'],
    ['1118012', 'IPVA'],
    ['1118013', 'ITCMD'],
    ['11130', 'IRRF'],
    ['1718011', 'FPE'],
    ['1758', 'FUNDEB'],
    ['171803', 'SUS'],
    ['171802', 'ROYALTIES'],
    ...COMMON_PREFIXES,
  ],
  antiga: [
    ['111302', 'ICMS'],
    // Multas e juros e dívida ativa do ICMS, que a estrutura antiga punha em 19….
    ['191142', 'ICMS'],
    ['193115', 'ICMS'],
    ['111205', 'IPVA'],
    ['111207', 'ITCMD'],
    ['111204', 'IRRF'],
    ['172101', 'FPE'],
    ['1724', 'FUNDEB'],
    ['172133', 'SUS'],
    ['172122', 'ROYALTIES'],
    ...COMMON_PREFIXES,
  ],
};

const CATEGORY_BY_KEY = new Map(REVENUE_CATEGORIES.map((category) => [category.key, category]));

function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Natureza em oito dígitos, sem pontuação. */
export function revenueNature(code: PortalRevenueRow['codigoreceita']): string {
  return String(code ?? '').replace(/\D/g, '').slice(0, 8);
}

/**
 * Categoria de uma natureza no exercício `year`, e se ela é dedução. A dedução
 * volta para o código de origem trocando o 9 inicial por 1 (as deduções do portal
 * são de receita corrente).
 */
export function classifyRevenue(
  code: PortalRevenueRow['codigoreceita'],
  year: number,
): { key: string; deduction: boolean } {
  const nature = revenueNature(code);
  const deduction = nature.startsWith('9');
  const base = deduction ? `1${nature.slice(1)}` : nature;
  const match = REVENUE_NATURE_PREFIXES[revenueNatureEra(year)].find(([prefix]) => base.startsWith(prefix));
  return { key: match?.[1] ?? 'OUTRAS_CAPITAL', deduction };
}

export interface RevenueRow {
  key: string;
  label: string;
  group: RevenueGroup;
  /** Arrecadado bruto por mês (índice 0 = janeiro), sem as deduções. */
  gross: number[];
  /** Deduções por mês (negativas), sobretudo a formação do FUNDEB. */
  deductions: number[];
  /** Arrecadado líquido por mês: bruto + deduções. */
  net: number[];
  /** Soma do ano do líquido. */
  netTotal: number;
  grossTotal: number;
  deductionsTotal: number;
  /** Previsão da lei, líquida das deduções previstas. */
  forecast: number;
  /** Previsão atualizada no último mês consultado, líquida. */
  updatedForecast: number;
}

/** Subtotal de um grupo: o que a tabela mostra na linha do grupo e o gráfico empilha. */
export interface RevenueGroupTotal {
  group: RevenueGroup;
  label: string;
  /** Líquido por mês (índice 0 = janeiro). */
  net: number[];
  netTotal: number;
  updatedForecast: number;
}

export interface RevenueSummary {
  year: number;
  /** Meses consultados (1–12), em ordem. */
  months: number[];
  rows: RevenueRow[];
  /** Subtotais por grupo, na ordem de {@link REVENUE_GROUPS}; só grupos com linhas. */
  groups: RevenueGroupTotal[];
  /** Líquido por mês, somando todas as categorias. */
  monthlyNet: number[];
  monthlyGross: number[];
  monthlyDeductions: number[];
  netTotal: number;
  grossTotal: number;
  deductionsTotal: number;
  forecast: number;
  updatedForecast: number;
}

/** Resposta de `GET /api/revenue`: o resumo gravado pela última coleta. */
export type RevenueDto = RevenueSummary & {
  /** Quando o job consultou o portal pela última vez para este exercício. */
  collectedAt: string;
  /** Mês em curso, ainda arrecadando (só no exercício corrente); `null` se o ano fechou. */
  partialMonth: number | null;
};

/**
 * Agregado de uma categoria num mês: é o que a coleta grava (`RevenueMonth`) e o
 * que o resumo lê. Previsões são as que o portal informava naquele mês.
 */
export interface RevenueBucket {
  month: number;
  category: string;
  gross: number;
  deductions: number;
  forecast: number;
  updatedForecast: number;
}

const zeros = () => Array.from({ length: 12 }, () => 0);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Linhas do portal → um agregado por mês e categoria. Nenhuma linha é descartada. */
export function bucketRevenue(year: number, monthRows: RevenueMonthRows[]): RevenueBucket[] {
  const buckets = new Map<string, RevenueBucket>();
  for (const { month, rows } of monthRows) {
    if (month < 1 || month > 12) continue;
    for (const line of rows) {
      const { key, deduction } = classifyRevenue(line.codigoreceita, year);
      const id = `${month}|${key}`;
      let bucket = buckets.get(id);
      if (!bucket) {
        bucket = { month, category: key, gross: 0, deductions: 0, forecast: 0, updatedForecast: 0 };
        buckets.set(id, bucket);
      }
      const collected = toNumber(line.arrecadado);
      if (deduction) bucket.deductions += collected;
      else bucket.gross += collected;
      bucket.forecast += toNumber(line.previsto);
      bucket.updatedForecast += toNumber(line.previstoatualizado);
    }
  }
  return [...buckets.values()].sort((a, b) => a.month - b.month || a.category.localeCompare(b.category));
}

/**
 * Agregados mensais → resumo do exercício. A previsão (lei e atualizada) vem do
 * último mês: o portal repete a previsão anual em todo mês, e a atualizada do
 * último mês é a mais recente. Categoria desconhecida (catálogo mudou depois da
 * coleta) cai em "Outras receitas correntes", para o total continuar fechando.
 */
export function summarizeRevenue(year: number, buckets: RevenueBucket[]): RevenueSummary {
  const months = [...new Set(buckets.map((bucket) => bucket.month))].sort((a, b) => a - b);
  const lastMonth = months.at(-1);
  const byKey = new Map<string, RevenueRow>();
  const rowFor = (key: string) => {
    const category = CATEGORY_BY_KEY.get(key) ?? CATEGORY_BY_KEY.get('OUTRAS_CORRENTES')!;
    let row = byKey.get(category.key);
    if (!row) {
      row = {
        key: category.key,
        label: category.label,
        group: category.group,
        gross: zeros(),
        deductions: zeros(),
        net: zeros(),
        netTotal: 0,
        grossTotal: 0,
        deductionsTotal: 0,
        forecast: 0,
        updatedForecast: 0,
      };
      byKey.set(category.key, row);
    }
    return row;
  };

  for (const bucket of buckets) {
    const index = bucket.month - 1;
    if (index < 0 || index > 11) continue;
    const row = rowFor(bucket.category);
    row.gross[index] += bucket.gross;
    row.deductions[index] += bucket.deductions;
    if (bucket.month === lastMonth) {
      row.forecast += bucket.forecast;
      row.updatedForecast += bucket.updatedForecast;
    }
  }

  const order = new Map(REVENUE_CATEGORIES.map((category, index) => [category.key, index]));
  const rows = [...byKey.values()]
    .map((row) => {
      const net = row.gross.map((value, index) => value + row.deductions[index]);
      return {
        ...row,
        net,
        netTotal: sum(net),
        grossTotal: sum(row.gross),
        deductionsTotal: sum(row.deductions),
      };
    })
    .sort((a, b) => order.get(a.key)! - order.get(b.key)!);

  const monthly = (source: RevenueRow[], pick: (row: RevenueRow) => number[]) =>
    zeros().map((_, index) => source.reduce((total, row) => total + pick(row)[index], 0));
  const monthlyNet = monthly(rows, (row) => row.net);
  const monthlyGross = monthly(rows, (row) => row.gross);
  const monthlyDeductions = monthly(rows, (row) => row.deductions);

  const groups = REVENUE_GROUPS.flatMap((group) => {
    const members = rows.filter((row) => row.group === group);
    if (!members.length) return [];
    const net = monthly(members, (row) => row.net);
    return [
      {
        group,
        label: REVENUE_GROUP_LABELS[group],
        net,
        netTotal: sum(net),
        updatedForecast: members.reduce((total, row) => total + row.updatedForecast, 0),
      },
    ];
  });

  return {
    year,
    months,
    rows,
    groups,
    monthlyNet,
    monthlyGross,
    monthlyDeductions,
    netTotal: sum(monthlyNet),
    grossTotal: sum(monthlyGross),
    deductionsTotal: sum(monthlyDeductions),
    forecast: rows.reduce((total, row) => total + row.forecast, 0),
    updatedForecast: rows.reduce((total, row) => total + row.updatedForecast, 0),
  };
}

/** Atalho: linhas do portal direto para o resumo (`bucketRevenue` + `summarizeRevenue`). */
export function aggregateRevenue(year: number, monthRows: RevenueMonthRows[]): RevenueSummary {
  return summarizeRevenue(year, bucketRevenue(year, monthRows));
}

/**
 * Arrecadado líquido de `current` contra o mesmo período de `previous` (meses
 * fechados de `current`; o mês em curso fica de fora para não comparar um mês
 * parcial com um inteiro). `null` sem ano anterior ou sem mês fechado.
 */
export function compareSamePeriod(
  current: Pick<RevenueDto, 'months' | 'partialMonth' | 'monthlyNet'>,
  previous: Pick<RevenueDto, 'monthlyNet'> | undefined,
): { months: number[]; currentNet: number; previousNet: number; change: number | null } | null {
  if (!previous) return null;
  const months = current.months.filter((month) => month !== current.partialMonth);
  if (!months.length) return null;
  const total = (values: number[]) => months.reduce((sum, month) => sum + values[month - 1], 0);
  const currentNet = total(current.monthlyNet);
  const previousNet = total(previous.monthlyNet);
  return {
    months,
    currentNet,
    previousNet,
    change: previousNet > 0 ? ((currentNet - previousNet) / previousNet) * 100 : null,
  };
}

/**
 * Líquido mensal por grupo somando **só as categorias marcadas** (filtro do gráfico
 * mês a mês). Grupos sem nenhuma categoria marcada ficam de fora; a ordem é a de
 * {@link REVENUE_GROUPS}. Com todas marcadas, é igual a `summary.groups`.
 */
export function selectedGroupNet(
  rows: RevenueRow[],
  selected: ReadonlySet<string>,
): Array<{ group: RevenueGroup; label: string; net: number[] }> {
  return REVENUE_GROUPS.flatMap((group) => {
    const members = rows.filter((row) => row.group === group && selected.has(row.key));
    if (!members.length) return [];
    const net = zeros().map((_, index) => members.reduce((total, row) => total + row.net[index], 0));
    return [{ group, label: REVENUE_GROUP_LABELS[group], net }];
  });
}
