'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { FlatThematicChartRow, mockFlatThematicData } from '@/types/chart-data';
import { formatMoney } from '@/lib/api';

interface LiquidatedByAxisChartProps {
  data?: FlatThematicChartRow[];
  height?: number;
}

const chartConfig = {
  liquidated: {
    label: 'Valor Liquidado',
    color: 'var(--chart-1)',
  },
} as const;

// Group colors by theme for visual distinction
const themeColors: Record<string, string> = {
  OCAD: 'var(--chart-1)',
  OSG: 'var(--chart-2)',
  CLIMATICO: 'var(--chart-3)',
};

export function LiquidatedByAxisChart({
  data = mockFlatThematicData,
  height = 400,
}: LiquidatedByAxisChartProps) {
  // Prepare data for grouped view: sort by theme then axis for logical grouping
  const chartData = [...data].sort((a, b) => {
    if (a.theme !== b.theme) return a.theme.localeCompare(b.theme);
    return a.axis.localeCompare(b.axis);
  });

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="axisLabel"
            angle={-35}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11 }}
          />
          <YAxis tickFormatter={(value) => formatMoney(Number(value)).replace('R$', '')} />
          <Tooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => [
                  formatMoney(Number(value)),
                  `${props.payload.themeLabel} — ${props.payload.axisLabel}`,
                ]}
              />
            }
          />
          <Legend />
          <Bar
            dataKey="liquidated"
            name="Valor Liquidado (R$)"
            fill="var(--chart-1)"
            radius={4}
            // Dynamic fill based on theme for grouping effect
            // Note: for true multi-bar grouping per theme we'd pivot; here we color by theme
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
