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
import type { ExecutionRow } from '@/lib/execution-monitor';
import { cn } from '@/lib/utils';

const chartConfig = {
  liquidated: { label: 'Liquidado', color: 'var(--chart-1)' },
} as const;

/** Quantas barras o gráfico mostra antes de virar ruído visual. */
const CHART_TOP_N = 12;
const TABLE_INITIAL_ROWS = 15;

function truncate(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Rótulo do eixo do gráfico. Prefixa o código quando ele é curto (elemento, grupo,
 * fonte) — sem isso, nomes longos truncam no mesmo texto e viram barras
 * indistinguíveis, como "Vencimentos e Vantagens Fixas — Pessoal Civil/Militar".
 * Chaves longas (ids de ação) são ignoradas por não dizerem nada ao leitor.
 */
function chartTick(row: ExecutionRow): string {
  const prefix = row.key.length <= 8 && row.key !== row.shortLabel ? `${row.key} ` : '';
  return `${prefix}${truncate(row.shortLabel, prefix ? 24 : 28)}`;
}

/** Abrevia valores no eixo (1.234.567 → "1,2 mi") para caber sem sobrepor. */
function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export type ExecutionBreakdownPanelProps = {
  title: string;
  description: string;
  rows: ExecutionRow[];
  /** Cabeçalho da primeira coluna, ex.: "Elemento de despesa". */
  entityLabel: string;
  /** Cabeçalho da coluna de contagem, ex.: "Linhas" ou "Ações". */
  countLabel: string;
  className?: string;
};

export function ExecutionBreakdownPanel({
  title,
  description,
  rows,
  entityLabel,
  countLabel,
  className,
}: ExecutionBreakdownPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const chartData = useMemo(
    () =>
      rows
        .filter((row) => row.liquidated > 0)
        .slice(0, CHART_TOP_N)
        .map((row) => ({ ...row, tick: chartTick(row) })),
    [rows],
  );

  const visibleRows = showAll ? rows : rows.slice(0, TABLE_INITIAL_ROWS);

  if (rows.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3Icon />
              </EmptyMedia>
              <EmptyTitle>Nada a exibir</EmptyTitle>
              <EmptyDescription>
                Nenhum registro corresponde aos filtros selecionados.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col gap-6">
        {chartData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: `${Math.max(200, chartData.length * 30 + 40)}px` }}
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => compactMoney(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="tick"
                width={190}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
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
              <Bar dataKey="liquidated" fill="var(--chart-1)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : null}

        <div className="min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[16rem]">{entityLabel}</TableHead>
                <TableHead className="text-right">{countLabel}</TableHead>
                <TableHead className="text-right">Dotação inicial</TableHead>
                <TableHead className="text-right">Atualizada</TableHead>
                <TableHead className="text-right">Empenhado</TableHead>
                <TableHead className="text-right">Liquidado</TableHead>
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
                  <TableCell className="text-right tabular-nums">{formatMoney(row.initialBudget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.updatedBudget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.committed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.liquidated)}</TableCell>
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
