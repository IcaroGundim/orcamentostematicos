'use client';

import { memo, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/api';
import {
  EXECUTION_METRIC_LABELS,
  EXECUTION_METRICS,
  type ExecutionMetric,
  type ExecutionRow,
} from '@/lib/execution-monitor';
import { cn } from '@/lib/utils';

/** Reordena do maior para o menor pela métrica escolhida (as agregações vêm por liquidado). */
function sortByMetric(rows: ExecutionRow[], metric: ExecutionMetric): ExecutionRow[] {
  return [...rows].sort((a, b) => b[metric] - a[metric]);
}

/** Limite de segurança para não renderizar milhares de barras num único SVG. */
const CHART_MAX_ROWS = 100;

function truncate(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Rótulo do eixo do gráfico. Prefixa o código quando ele é curto (elemento, grupo,
 * categoria, modalidade, fonte) — sem isso, nomes longos truncam no mesmo texto e
 * viram barras indistinguíveis, como "Vencimentos e Vantagens Fixas — Pessoal
 * Civil/Militar". Chaves longas (ids de ação) são ignoradas por não dizerem nada.
 *
 * O corte é sobre o texto **inteiro** (prefixo incluído): o Recharts quebra o tick
 * em várias linhas quando ele passa da largura do eixo, e aí os rótulos de barras
 * vizinhas se sobrepõem. `AXIS_TICK_MAX_CHARS` é calibrado para caber em uma linha
 * em {@link AXIS_WIDTH} px com fonte 10.
 */
const AXIS_WIDTH = 120;
const AXIS_TICK_MAX_CHARS = 18;

/**
 * Faixa do header mais baixa que o padrão do card compacto (`py-3`). Mantida
 * simétrica de propósito: padding assimétrico faz o título colar numa das bordas
 * do fundo verde.
 */
const PANEL_CLASS =
  '!gap-0 overflow-hidden rounded-none border-black/70 bg-white !py-0 shadow-none';
const CHART_HEADER_CLASS =
  '!mt-0 !rounded-none border-b border-black/70 bg-green-900 px-3 py-2 text-white';

function chartTick(row: ExecutionRow): string {
  if (row.chartLabel) return truncate(row.chartLabel, AXIS_TICK_MAX_CHARS);
  const prefix = row.key.length <= 8 && row.key !== row.shortLabel ? `${row.key} ` : '';
  return truncate(`${prefix}${row.shortLabel}`, AXIS_TICK_MAX_CHARS);
}

/** Abrevia valores no eixo (1.234.567 → "1,2 mi") para caber sem sobrepor. */
function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card size="sm" className={cn('flex h-full min-h-0 flex-col', PANEL_CLASS)}>
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="font-semibold uppercase tracking-wide">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-semibold">Nenhum dado para exibir</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Não há registros correspondentes aos filtros aplicados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Formata um percentual com 1 casa decimal pt-BR (sem o símbolo de moeda). */
function percentFormatter(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/**
 * Tooltip dos gráficos de ciclo/dispersão.
 *
 * Mantém **todas** as informações que o `ChartTooltipContent` padrão do projeto
 * mostrava — cabeçalho com o recorte e uma linha por item (nome + valor) — mas
 * corrige a forma de exibição:
 *
 * - valores monetários com `formatMoney` e a taxa de execução como percentual
 *   (antes, o formatter genérico transformava o % em "R$ 70,50");
 * - estilo dentro do contrato do módulo (`rounded-none`, `border-black/70`,
 *   `shadow-none`) em vez do `rounded-lg`/`shadow-xl` do componente padrão;
 * - os itens sem `name` definido (barras empilhadas) deixam de mostrar o valor
 *   cru sem rótulo.
 */
function CycleTooltipContent({
  active,
  payload,
  headerKey,
  formatters,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: string | number;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
  }>;
  /** Campo do item cujo valor vira o cabeçalho (padrão: `label`). */
  headerKey?: string;
  /** Formatadores por `dataKey`; o padrão é `formatMoney`. */
  formatters?: Record<string, (value: number) => string>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const header =
    headerKey && row ? String(row[headerKey] ?? '') : (row?.label as string | undefined);
  const items = payload.filter((item) => item.value != null);
  if (!items.length) return null;
  return (
    <div className="rounded-none border border-black/70 bg-white px-2.5 py-1.5 text-xs shadow-none">
      {header ? (
        <div className="mb-1 border-b border-black/20 pb-1 font-semibold tabular-nums">{header}</div>
      ) : null}
      <div className="grid gap-1">
        {items.map((item, index) => {
          const formatter = formatters?.[String(item.dataKey ?? item.name)] ?? formatMoney;
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{String(item.name ?? '')}</span>
              <span className="font-medium tabular-nums">{formatter(Number(item.value))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Card compacto (célula da grade) ──────────────────────────────────────────

export type ExecutionChartCardProps = {
  title: string;
  rows: ExecutionRow[];
  /** Estágio da despesa exibido nas barras (dotação, empenhado, liquidado, pago). */
  metric: ExecutionMetric;
  /** Texto curto sob o título; omitido quando o título já basta. */
  description?: string;
  /** Cor das barras; mantém a cor padrão do sistema quando não informada. */
  color?: string;
  className?: string;
};

/**
 * Card só com o gráfico, dimensionado para uma célula da grade 3×2. A tabela
 * detalhada correspondente fica em {@link ExecutionTablePanel}, abaixo da grade.
 *
 * Memoizado porque o dashboard mantém todas as abas montadas (`forceMount`, que é o
 * que evita o piscar ao alternar). Sem `memo`, qualquer mudança de estado da página
 * — trocar de aba, de métrica ou de filtro — re-renderizaria os mais de 20 gráficos
 * Recharts de todas as abas, inclusive as ocultas. As props são estáveis: `rows` sai
 * de `useMemo`, `metric` é primitivo e os textos são literais.
 */
export const ExecutionChartCard = memo(function ExecutionChartCard({
  title,
  rows,
  metric,
  description,
  color = 'var(--chart-1)',
  className,
}: ExecutionChartCardProps) {
  const chartData = useMemo(
    () =>
      sortByMetric(rows, metric)
        .filter((row) => row[metric] > 0)
        .slice(0, CHART_MAX_ROWS)
        .map((row) => ({ ...row, tick: chartTick(row) })),
    [rows, metric],
  );
  const axisWidth = useMemo(() => {
    const longestTick = chartData.reduce(
      (longest, row) => Math.max(longest, row.tick.length),
      0,
    );
    return Math.min(AXIS_WIDTH, Math.max(52, Math.ceil(longestTick * 5.4 + 10)));
  }, [chartData]);

  // A chave do config precisa casar com o dataKey para o tooltip resolver o rótulo.
  const chartConfig = useMemo(
    () => ({ [metric]: { label: EXECUTION_METRIC_LABELS[metric], color } }),
    [metric, color],
  );

  if (chartData.length === 0) return <EmptyState title={title} description={description} />;

  return (
    // `size="sm"` é a variante compacta do design system: reduz o padding do header
    // (que tem fundo verde por padrão) e o tamanho do título. Sem ela, o header fica
    // desproporcional numa célula da grade.
    <Card
      size="sm"
      className={cn('flex h-full min-h-0 min-w-0 flex-col', PANEL_CLASS, className)}
    >
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="font-semibold uppercase leading-snug tracking-wide">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        <ChartContainer
          config={chartConfig}
          className="min-h-full w-full shrink-0 aspect-auto"
          style={{ height: `${Math.max(170, chartData.length * 26 + 34)}px` }}
        >
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={chartData}
            margin={{ top: 2, right: 12, left: 2, bottom: 2 }}
            barCategoryGap="16%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <YAxis
              type="category"
              dataKey="tick"
              width={axisWidth}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ExecutionRow | undefined;
                    return row ? row.label : '';
                  }}
                />
              }
            />
            <Bar
              dataKey={metric}
              fill={color}
              stroke="none"
              radius={0}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

// ── Tabela em largura total (abaixo da grade) ────────────────────────────────

export type ExecutionTablePanelProps = {
  title: string;
  description: string;
  rows: ExecutionRow[];
  /** Métrica que ordena a tabela — a mesma dos gráficos, para as duas leituras baterem. */
  metric: ExecutionMetric;
  /** Cabeçalho da primeira coluna, ex.: "Elemento de despesa". */
  entityLabel: string;
  /** Cabeçalho da coluna de contagem, ex.: "Linhas" ou "Ações". */
  countLabel: string;
  /**
   * Colunas de valor. O padrão são os estágios da despesa orçamentária; outros
   * domínios (a folha de pagamento, por exemplo) passam as suas para os cabeçalhos
   * não mentirem sobre o que a coluna contém.
   */
  moneyColumns?: MoneyColumn[];
  /** Oculta a coluna de percentual, que só faz sentido na execução orçamentária. */
  hideRate?: boolean;
  className?: string;
};

export type MoneyColumn = { metric: ExecutionMetric; header: string };

/** Colunas de valor padrão, na ordem do ciclo da despesa orçamentária. */
const MONEY_COLUMNS: MoneyColumn[] = [
  { metric: 'initialBudget', header: 'Dotação inicial' },
  { metric: 'updatedBudget', header: 'Atualizada' },
  { metric: 'committed', header: 'Empenhado' },
  { metric: 'liquidated', header: 'Liquidado' },
  { metric: 'paid', header: 'Pago' },
];

/** Memoizado pelo mesmo motivo do {@link ExecutionChartCard}. */
export const ExecutionTablePanel = memo(function ExecutionTablePanel({
  title,
  description,
  rows,
  metric,
  entityLabel,
  countLabel,
  moneyColumns = MONEY_COLUMNS,
  hideRate = false,
  className,
}: ExecutionTablePanelProps) {
  const sortedRows = useMemo(() => sortByMetric(rows, metric), [rows, metric]);

  if (rows.length === 0) return <EmptyState title={title} description={description} />;

  return (
    <Card size="sm" className={cn('flex min-h-0 flex-col', PANEL_CLASS, className)}>
      <CardHeader className={cn('shrink-0', CHART_HEADER_CLASS)}>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 font-semibold uppercase tracking-wide">
          <span>{title}</span>
          {/* A contagem vinha do antigo botão "Mostrar todos os N"; com a rolagem
              ela precisa aparecer em algum lugar, senão some do painel. */}
          <span className="text-xs font-normal normal-case tabular-nums opacity-80">
            {sortedRows.length.toLocaleString('pt-BR')} registro
            {sortedRows.length === 1 ? '' : 's'}
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 px-0">
        {/* O teto próprio garante rolagem mesmo quando o contêiner pai não limita a
            altura — sem ele, a tabela cresceria indefinidamente (é o caso dos painéis
            da folha de pagamento). Onde o pai já limita, prevalece o menor. */}
        <div className="min-h-0 min-w-0 max-h-[26rem] flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-stone-50">
              <TableRow className="border-b border-black/70">
                <TableHead className="min-w-[16rem]">{entityLabel}</TableHead>
                <TableHead className="text-right">{countLabel}</TableHead>
                {moneyColumns.map((column) => (
                  <TableHead
                    key={column.metric}
                    className={cn('text-right', column.metric === metric && 'text-foreground font-semibold')}
                  >
                    {column.header}
                  </TableHead>
                ))}
                {hideRate ? null : <TableHead className="text-right">Execução</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.key} className="odd:bg-stone-50/60">
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count.toLocaleString('pt-BR')}
                  </TableCell>
                  {moneyColumns.map((column) => (
                    <TableCell
                      key={column.metric}
                      className={cn(
                        'text-right tabular-nums',
                        column.metric === metric && 'font-semibold',
                      )}
                    >
                      {formatMoney(row[column.metric])}
                    </TableCell>
                  ))}
                  {hideRate ? null : (
                    <TableCell className="text-right tabular-nums">
                      {row.executionRate.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

      </CardContent>
    </Card>
  );
});

// ── Barras empilhadas do ciclo da despesa ────────────────────────────────────

/**
 * Uma barra por recorte (pela dotação atualizada), dividida nos 4 segmentos do
 * ciclo da despesa. Os segmentos são derivados dos totais que toda `ExecutionRow`
 * já carrega — não há agregação nova:
 *
 * - Não empenhado = dotação atualizada − empenhado
 * - Empenhado não liquidado = empenhado − liquidado
 * - Liquidado não pago = liquidado − pago
 * - Pago = pago
 *
 * A soma dos 4 segmentos fecha com `updatedBudget` do recorte (nada some, nada
 * duplica — mesma garantia das agregações da seção 6.3 do contrato).
 */
export const CycleStackedBarChart = memo(function CycleStackedBarChart({
  title,
  rows,
  description,
  className,
}: {
  title: string;
  rows: ExecutionRow[];
  description?: string;
  className?: string;
}) {
  const chartData = useMemo(
    () =>
      sortByMetric(rows, 'updatedBudget')
        .filter((row) => row.updatedBudget > 0)
        .slice(0, CHART_MAX_ROWS)
        .map((row) => {
          const notCommitted = Math.max(0, row.updatedBudget - row.committed);
          const committedNotLiquidated = Math.max(0, row.committed - row.liquidated);
          const liquidatedNotPaid = Math.max(0, row.liquidated - row.paid);
          return {
            ...row,
            tick: chartTick(row),
            notCommitted,
            committedNotLiquidated,
            liquidatedNotPaid,
          };
        }),
    [rows],
  );

  if (chartData.length === 0) return <EmptyState title={title} description={description} />;

  const config = {
    notCommitted: { label: 'Não empenhado', color: '#c8c89f' },
    committedNotLiquidated: { label: 'Empenhado não liquidado', color: '#b8b477' },
    liquidatedNotPaid: { label: 'Liquidado não pago', color: '#8fa873' },
    paid: { label: 'Pago', color: '#5f8f70' },
  } as const;

  return (
    <Card
      size="sm"
      className={cn('flex h-full min-h-0 min-w-0 flex-col', PANEL_CLASS, className)}
    >
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="font-semibold uppercase leading-snug tracking-wide">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        <ChartContainer
          config={config}
          className="min-h-full w-full shrink-0 aspect-auto"
          style={{ height: `${Math.max(170, chartData.length * 26 + 34)}px` }}
        >
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={chartData}
            margin={{ top: 2, right: 12, left: 2, bottom: 2 }}
            barCategoryGap="16%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <YAxis
              type="category"
              dataKey="tick"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <ChartTooltip
              content={
                <CycleTooltipContent
                  formatters={{
                    notCommitted: formatMoney,
                    committedNotLiquidated: formatMoney,
                    liquidatedNotPaid: formatMoney,
                    paid: formatMoney,
                  }}
                />
              }
            />
            <Bar dataKey="paid" stackId="cycle" fill="#5f8f70" radius={0} />
            <Bar dataKey="liquidatedNotPaid" stackId="cycle" fill="#8fa873" radius={0} />
            <Bar dataKey="committedNotLiquidated" stackId="cycle" fill="#b8b477" radius={0} />
            <Bar dataKey="notCommitted" stackId="cycle" fill="#c8c89f" radius={0} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

// ── Curva do ciclo (linha) ───────────────────────────────────────────────────

/**
 * Uma linha por item do top-N (por dotação atualizada), com o eixo X nos 5
 * estágios do ciclo da despesa. Mostra o "atrito" da execução: onde a linha cai
 * muito entre um estágio e outro, há dinheiro parado naquele trecho.
 */
export const CycleLineChart = memo(function CycleLineChart({
  title,
  rows,
  topN = 8,
  description,
  className,
}: {
  title: string;
  rows: ExecutionRow[];
  topN?: number;
  description?: string;
  className?: string;
}) {
  const { lines, palette } = useMemo(() => {
    const top = sortByMetric(rows, 'updatedBudget')
      .filter((row) => row.updatedBudget > 0)
      .slice(0, topN);
    // Paleta fixa da seção 4.1 (5 cores), cíclica para até 8 linhas.
    const palette = ['#5f8f70', '#8fa873', '#b8b477', '#110f24', '#c8c89f'];
    return {
      lines: top,
      palette,
    };
  }, [rows, topN]);

  const chartData = useMemo(
    () =>
      EXECUTION_METRICS.map((metric) => ({
        stage: EXECUTION_METRIC_LABELS[metric],
        ...Object.fromEntries(lines.map((line) => [line.key, line[metric]])),
      })),
    [lines],
  );

  if (lines.length === 0) return <EmptyState title={title} description={description} />;

  return (
    <Card
      size="sm"
      className={cn('flex h-full min-h-0 min-w-0 flex-col', PANEL_CLASS, className)}
    >
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="font-semibold uppercase leading-snug tracking-wide">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        <ChartContainer
          config={Object.fromEntries(
            lines.map((line, index) => [
              line.key,
              { label: line.shortLabel, color: palette[index % palette.length] },
            ]),
          )}
          className="min-h-full w-full shrink-0 aspect-auto"
          style={{ height: `${Math.max(170, lines.length * 26 + 34)}px` }}
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 2, right: 12, left: 2, bottom: 2 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <ChartTooltip content={<CycleTooltipContent headerKey="stage" />} />
            {lines.map((line, index) => (
              <Line
                key={line.key}
                type="linear"
                dataKey={line.key}
                name={line.label}
                stroke={palette[index % palette.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: palette[index % palette.length], strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

// ── Dispersão dotação × execução ─────────────────────────────────────────────

/**
 * Cada ponto é um recorte (por ação/órgão): X = dotação atualizada, Y = taxa de
 * execução (%), tamanho da bolha = pago. Localiza "orçamento grande com execução
 * baixa" — o quadrante inferior direito do gráfico.
 */
export const ExecutionScatterChart = memo(function ExecutionScatterChart({
  title,
  rows,
  description,
  className,
}: {
  title: string;
  rows: ExecutionRow[];
  description?: string;
  className?: string;
}) {
  const chartData = useMemo(
    () =>
      rows
        .filter((row) => row.updatedBudget > 0 && row.executionRate > 0)
        .slice(0, CHART_MAX_ROWS)
        .map((row) => ({
          ...row,
          budget: row.updatedBudget,
          rate: row.executionRate,
          paid: row.paid,
        })),
    [rows],
  );

  if (chartData.length === 0) return <EmptyState title={title} description={description} />;

  const config = {
    execution: { label: 'Execução (%)', color: '#5f8f70' },
  } as const;

  return (
    <Card
      size="sm"
      className={cn('flex h-full min-h-0 min-w-0 flex-col', PANEL_CLASS, className)}
    >
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="font-semibold uppercase leading-snug tracking-wide">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        <ChartContainer
          config={config}
          className="min-h-full w-full shrink-0 aspect-auto"
          style={{ height: `${Math.max(170, Math.min(chartData.length, 8) * 26 + 34)}px` }}
        >
          <ScatterChart
            accessibilityLayer
            margin={{ top: 2, right: 12, left: 2, bottom: 2 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="budget"
              name="Dotação atualizada"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <YAxis
              type="number"
              dataKey="rate"
              name="Execução"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${Number(value)}%`}
            />
            <ZAxis type="number" dataKey="paid" range={[40, 400]} name="Pago" />
            <ChartTooltip
              content={
                <CycleTooltipContent
                  formatters={{
                    budget: formatMoney,
                    rate: percentFormatter,
                    paid: formatMoney,
                  }}
                />
              }
            />
            <Scatter
              data={chartData}
              fill="#5f8f70"
              stroke="none"
              shape="circle"
            />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});
