'use client';

import { Cell, Pie, PieChart } from 'recharts';

type ThemeExecutionGaugeProps = {
  /** Percentual de execução (0–100+): o arco preenchido. */
  pct: number;
  /** Cor do arco preenchido. */
  color: string;
};

/**
 * Medidor semicircular de execução por tema. Vive em módulo próprio para que o
 * `recharts` saia do bundle de entrada de `/seplan` (só o relatório o usa).
 */
export function ThemeExecutionGauge({ pct, color }: ThemeExecutionGaugeProps) {
  return (
    <PieChart width={220} height={120}>
      <Pie
        data={[{ value: pct }, { value: 100 - pct }]}
        cx={110}
        cy={110}
        startAngle={180}
        endAngle={0}
        innerRadius={68}
        outerRadius={100}
        dataKey="value"
        strokeWidth={0}
      >
        <Cell fill={color} />
        <Cell fill="var(--color-muted)" />
      </Pie>
    </PieChart>
  );
}
