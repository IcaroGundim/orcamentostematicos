'use client';

import { useId, useMemo, useState } from 'react';
import {
  LiquidatedByAxisChart,
  chartHeightForRowCount,
} from '@/components/charts/LiquidatedByAxisChart';
import { Label } from '@/components/ui/label';
import { HoverTabsList, Tabs } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/api';
import {
  filterAxisRowsWithData,
  sortAxisRowsForDisplay,
  toFlatChartRows,
  type AxisExecutionRow,
} from '@/lib/thematic-axis-report';
import { cn } from '@/lib/utils';
import type { ThemeBudget } from '@/types/domain';

export type ThemeAxisTotals = {
  actionsCount: number;
  liquidated: number;
  planned: number;
  executionPct: number;
};

type Dimension = 'axis' | 'classification';

type AxisExecutionByThemePanelProps = {
  theme: ThemeBudget;
  rows: AxisExecutionRow[];
  totals: ThemeAxisTotals;
  classificationRows?: AxisExecutionRow[];
  classificationTotals?: ThemeAxisTotals;
};

function formatPct(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const dimensionCopy = {
  axis: {
    chartTitle: 'Valor liquidado por eixo',
    sectionTitle: 'Detalhamento por eixo',
    columnHeader: 'Eixo',
    showAllToggle: 'Mostrar eixos sem classificação',
  },
  classification: {
    chartTitle: 'Valor liquidado por classificação',
    sectionTitle: 'Detalhamento por classificação',
    columnHeader: 'Classificação',
    showAllToggle: 'Mostrar classificações sem ações',
  },
} as const;

export function AxisExecutionByThemePanel({
  rows,
  totals,
  classificationRows,
  classificationTotals,
}: AxisExecutionByThemePanelProps) {
  const toggleId = useId();
  const [showAll, setShowAll] = useState(false);
  const [dimension, setDimension] = useState<Dimension>('axis');

  const hasClassification = classificationRows != null && classificationTotals != null;

  const activeRows = dimension === 'classification' && hasClassification ? classificationRows : rows;
  const activeTotals =
    dimension === 'classification' && hasClassification ? classificationTotals : totals;
  const copy = dimensionCopy[dimension];

  const rowsWithData = useMemo(
    () => sortAxisRowsForDisplay(filterAxisRowsWithData(activeRows)),
    [activeRows],
  );

  const tableRows = useMemo(
    () => (showAll ? sortAxisRowsForDisplay(activeRows) : rowsWithData),
    [activeRows, showAll, rowsWithData],
  );

  const chartHeight = Math.max(chartHeightForRowCount(rowsWithData.length), 280);
  const useTableScroll = tableRows.length > 8;

  const kpiItems = [
    { label: 'Ações classificadas', value: activeTotals.actionsCount.toLocaleString('pt-BR') },
    { label: 'Liquidado', value: formatMoney(activeTotals.liquidated) },
    { label: 'Planejado (atualizado)', value: formatMoney(activeTotals.planned) },
    { label: 'Execução', value: formatPct(activeTotals.executionPct) },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {hasClassification ? (
        <div className="flex justify-end">
          <Tabs value={dimension} onValueChange={(value) => setDimension(value as Dimension)}>
            <HoverTabsList
              activeValue={dimension}
              items={[
                { value: 'axis', content: 'Por eixo' },
                { value: 'classification', content: 'Por classificação' },
              ]}
            />
          </Tabs>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:items-stretch">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {kpiItems.map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{copy.chartTitle}</p>
          <div className="min-h-0 flex-1">
            <LiquidatedByAxisChart
              data={toFlatChartRows(rowsWithData)}
              layout="horizontal"
              height={chartHeight}
              autoHeight={false}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{copy.sectionTitle}</p>
          <div className="flex items-center gap-2">
            <input
              id={toggleId}
              type="checkbox"
              className="size-4 rounded border border-input accent-primary"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            <Label htmlFor={toggleId} className="cursor-pointer text-sm font-normal text-muted-foreground">
              {copy.showAllToggle}
            </Label>
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg border',
            useTableScroll && 'max-h-[min(50vh,420px)] overflow-auto',
          )}
        >
          <Table>
            <TableHeader className={cn(useTableScroll && 'sticky top-0 z-10 bg-background shadow-sm')}>
              <TableRow>
                <TableHead>{copy.columnHeader}</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                <TableHead className="text-right">Liquidado</TableHead>
                <TableHead className="text-right">% do tema</TableHead>
                <TableHead className="min-w-[8.5rem] text-right">Execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow
                  key={`${row.theme}-${row.axis}`}
                  className={cn(row.actionsCount === 0 && 'text-muted-foreground')}
                >
                  <TableCell className="font-medium">{row.axisLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.actionsCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.liquidated)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(row.pctOfTheme)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="tabular-nums text-sm">
                        {row.planned > 0 ? formatPct(row.executionPct) : '—'}
                      </span>
                      {row.planned > 0 ? (
                        <div className="h-1 w-full max-w-[7rem] overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${row.executionPct}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total do tema</TableCell>
                <TableCell className="text-right tabular-nums">{activeTotals.actionsCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(activeTotals.liquidated)}</TableCell>
                <TableCell className="text-right tabular-nums">100,0%</TableCell>
                <TableCell className="text-right">
                  <span className="tabular-nums">
                    {activeTotals.planned > 0 ? formatPct(activeTotals.executionPct) : '—'}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
