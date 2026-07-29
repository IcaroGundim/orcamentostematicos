'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BarChart3Icon } from 'lucide-react';
import { formatMoney } from '@/lib/api';
import {
  EXECUTION_METRIC_LABELS,
  type ExecutionMetric,
  type ExecutionRow,
} from '@/lib/execution-monitor';
import { cn } from '@/lib/utils';

/** Reordena do maior para o menor pela métrica escolhida (as agregações vêm por liquidado). */
function sortByMetric(rows: ExecutionRow[], metric: ExecutionMetric): ExecutionRow[] {
  return [...rows].sort((a, b) => b[metric] - a[metric]);
}

/**
 * Quantas barras cabem numa célula da grade 3×2 sem virar ruído. Menor que o
 * antigo painel de largura total justamente porque a célula tem ~1/3 da largura.
 */
const CHART_TOP_N = 8;
const TABLE_INITIAL_ROWS = 15;

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
const CHART_HEADER_CLASS = 'py-2';

function chartTick(row: ExecutionRow): string {
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
    <Card size="sm" className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3Icon />
            </EmptyMedia>
            <EmptyTitle>Nada a exibir</EmptyTitle>
            <EmptyDescription>Nenhum registro corresponde aos filtros.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
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
  className?: string;
};

/**
 * Card só com o gráfico, dimensionado para uma célula da grade 3×2. A tabela
 * detalhada correspondente fica em {@link ExecutionTablePanel}, abaixo da grade.
 */
export function ExecutionChartCard({
  title,
  rows,
  metric,
  description,
  className,
}: ExecutionChartCardProps) {
  const chartData = useMemo(
    () =>
      sortByMetric(rows, metric)
        .filter((row) => row[metric] > 0)
        .slice(0, CHART_TOP_N)
        .map((row) => ({ ...row, tick: chartTick(row) })),
    [rows, metric],
  );

  // A chave do config precisa casar com o dataKey para o tooltip resolver o rótulo.
  const chartConfig = useMemo(
    () => ({ [metric]: { label: EXECUTION_METRIC_LABELS[metric], color: 'var(--chart-1)' } }),
    [metric],
  );

  if (chartData.length === 0) return <EmptyState title={title} description={description} />;

  return (
    // `size="sm"` é a variante compacta do design system: reduz o padding do header
    // (que tem fundo verde por padrão) e o tamanho do título. Sem ela, o header fica
    // desproporcional numa célula da grade.
    <Card size="sm" className={cn('flex h-full min-h-0 min-w-0 flex-col overflow-hidden', className)}>
      <CardHeader className={CHART_HEADER_CLASS}>
        <CardTitle className="leading-snug">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1">
        <ChartContainer
          config={chartConfig}
          className="h-full min-h-0 w-full flex-1 aspect-auto"
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
              width={AXIS_WIDTH}
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
            <Bar dataKey={metric} fill="var(--chart-1)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

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
  className?: string;
};

/** Colunas de valor, na ordem do ciclo da despesa. */
const MONEY_COLUMNS: { metric: ExecutionMetric; header: string }[] = [
  { metric: 'initialBudget', header: 'Dotação inicial' },
  { metric: 'updatedBudget', header: 'Atualizada' },
  { metric: 'committed', header: 'Empenhado' },
  { metric: 'liquidated', header: 'Liquidado' },
  { metric: 'paid', header: 'Pago' },
];

export function ExecutionTablePanel({
  title,
  description,
  rows,
  metric,
  entityLabel,
  countLabel,
  className,
}: ExecutionTablePanelProps) {
  const [showAll, setShowAll] = useState(false);
  const sortedRows = useMemo(() => sortByMetric(rows, metric), [rows, metric]);
  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, TABLE_INITIAL_ROWS);

  if (rows.length === 0) return <EmptyState title={title} description={description} />;

  return (
    <Card size="sm" className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader className="shrink-0 py-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[16rem]">{entityLabel}</TableHead>
                <TableHead className="text-right">{countLabel}</TableHead>
                {MONEY_COLUMNS.map((column) => (
                  <TableHead
                    key={column.metric}
                    className={cn('text-right', column.metric === metric && 'text-foreground font-semibold')}
                  >
                    {column.header}
                  </TableHead>
                ))}
                <TableHead className="text-right">Execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count.toLocaleString('pt-BR')}
                  </TableCell>
                  {MONEY_COLUMNS.map((column) => (
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
                  <TableCell className="text-right tabular-nums">
                    {row.executionRate.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {rows.length > TABLE_INITIAL_ROWS ? (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? 'Mostrar menos'
              : `Mostrar todos os ${rows.length.toLocaleString('pt-BR')} registros`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
