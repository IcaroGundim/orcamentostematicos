'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { FlatThematicChartRow } from '@/types/chart-data';
import { formatMoney } from '@/lib/api';

interface LiquidatedByAxisChartProps {
  data?: FlatThematicChartRow[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
  autoHeight?: boolean;
}

const chartConfig = {
  liquidated: {
    label: 'Valor Liquidado',
    color: 'var(--chart-1)',
  },
} as const;

const themeColors: Record<string, string> = {
  OCAD: 'var(--chart-1)',
  OSG: 'var(--chart-2)',
  CLIMATICO: 'var(--chart-3)',
};

function sortChartData(data: FlatThematicChartRow[]) {
  return [...data].sort((a, b) => {
    if (b.liquidated !== a.liquidated) return b.liquidated - a.liquidated;
    return a.axisLabel.localeCompare(b.axisLabel, 'pt-BR');
  });
}

export function chartHeightForRowCount(count: number, min = 240) {
  return Math.max(min, count * 44 + 48);
}

export function LiquidatedByAxisChart({
  data = [],
  height,
  layout = 'horizontal',
  autoHeight = true,
}: LiquidatedByAxisChartProps) {
  const chartData = useMemo(() => sortChartData(data), [data]);
  const resolvedHeight =
    height ?? (autoHeight ? chartHeightForRowCount(chartData.length) : layout === 'horizontal' ? 320 : 400);

  if (chartData.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        style={{ height: resolvedHeight }}
      >
        Sem dados para exibir no gráfico.
      </div>
    );
  }

  const fill = chartData[0] ? themeColors[chartData[0].theme] ?? 'var(--chart-1)' : 'var(--chart-1)';

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: resolvedHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        {layout === 'horizontal' ? (
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 12, right: 24, left: 8, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => formatMoney(Number(value)).replace('R$', '').trim()}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="axisLabel"
              width={200}
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />}
            />
            <Bar dataKey="liquidated" name="Valor liquidado" radius={4} fill={fill}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.theme}-${entry.axis}-${index}`}
                  fill={themeColors[entry.theme] ?? fill}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="axisLabel"
              angle={-35}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickFormatter={(value) => formatMoney(Number(value)).replace('R$', '').trim()} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />}
            />
            <Bar dataKey="liquidated" name="Valor liquidado" radius={4}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.theme}-${entry.axis}-${index}`}
                  fill={themeColors[entry.theme] ?? 'var(--chart-1)'}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  );
}
