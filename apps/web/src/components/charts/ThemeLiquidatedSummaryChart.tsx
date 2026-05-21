'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatMoney, themeLabels } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Summary, ThemeBudget } from '@/types/domain';

const themeColors: Record<ThemeBudget, string> = {
  OCAD: 'var(--chart-1)',
  OSG: 'var(--chart-2)',
  CLIMATICO: 'var(--chart-3)',
};

const chartConfig = {
  liquidated: {
    label: 'Valor liquidado',
    color: 'var(--chart-1)',
  },
} as const;

type ThemeLiquidatedSummaryChartProps = {
  data: Summary['totalsByTheme'];
  className?: string;
};

type ChartRow = Summary['totalsByTheme'][number] & { themeLabel: string };

export function ThemeLiquidatedSummaryChart({ data, className }: ThemeLiquidatedSummaryChartProps) {
  const chartData = useMemo<ChartRow[]>(
    () =>
      [...data]
        .sort((a, b) => b.liquidated - a.liquidated)
        .map((row) => ({
          ...row,
          themeLabel: themeLabels[row.theme],
        })),
    [data],
  );

  const isEmpty = chartData.length === 0 || chartData.every((row) => row.liquidated === 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex h-[200px] min-h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground',
          className,
        )}
      >
        Nenhum valor liquidado para exibir.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[200px] min-h-[160px] w-full [&_.recharts-responsive-container]:!h-full"
      >
        <BarChart
          accessibilityLayer
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatMoney(Number(value)).replace('R$', '').trim()}
          />
          <YAxis
            type="category"
            dataKey="theme"
            width={72}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => themeLabels[value as ThemeBudget] ?? String(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatMoney(Number(value))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  return row ? `${row.actions} ações classificadas` : '';
                }}
              />
            }
          />
          <Bar dataKey="liquidated" radius={4}>
            {chartData.map((entry) => (
              <Cell key={entry.theme} fill={themeColors[entry.theme]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      <div className="flex shrink-0 flex-wrap gap-3 text-xs text-muted-foreground">
        {chartData.map((entry) => (
          <div key={entry.theme} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: themeColors[entry.theme] }}
              aria-hidden
            />
            <span className="font-medium text-foreground">{entry.themeLabel}</span>
            <span className="tabular-nums">{formatMoney(entry.liquidated)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
