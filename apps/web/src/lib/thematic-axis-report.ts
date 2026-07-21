import { themeLabels } from '@/lib/api';
import { thematicBudgetContribution } from '@/lib/classification-rules';
import type { FlatThematicChartRow } from '@/types/chart-data';
import type { BudgetAction, Metadata, ThemeBudget } from '@/types/domain';

const THEMES: ThemeBudget[] = ['OCAD', 'OSG', 'CLIMATICO'];

export type AxisExecutionRow = {
  theme: ThemeBudget;
  axis: string;
  axisLabel: string;
  actionsCount: number;
  liquidated: number;
  planned: number;
  pctOfTheme: number;
  executionPct: number;
};

type AggEntry = {
  theme: ThemeBudget;
  axis: string;
  actionIds: Set<string>;
  liquidated: number;
  planned: number;
};

export type ExecutionDimension = 'axis' | 'classification';

function buildExecutionReport(
  actions: BudgetAction[],
  metadata: Metadata | null,
  dimension: ExecutionDimension,
  executedByAssignment?: Map<string, number>,
): AxisExecutionRow[] {
  const agg = new Map<string, AggEntry>();

  for (const action of actions) {
    const seen = new Set<string>();
    for (const asgn of action.assignments) {
      const key = dimension === 'axis' ? asgn.axis : asgn.classification;
      if (!key) continue;
      const pairKey = `${asgn.theme}:${key}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      let entry = agg.get(pairKey);
      if (!entry) {
        entry = {
          theme: asgn.theme,
          axis: key,
          actionIds: new Set(),
          liquidated: 0,
          planned: 0,
        };
        agg.set(pairKey, entry);
      }
      const contribution = thematicBudgetContribution({
        theme: asgn.theme,
        classification: asgn.classification,
        weightingFactor: asgn.weightingFactor,
        initialBudget: action.totals.initialBudget,
        liquidated: action.totals.liquidated,
        deliveryExecutedValue: executedByAssignment?.get(asgn.id),
      });
      entry.actionIds.add(action.id);
      entry.liquidated += contribution.liquidated;
      entry.planned += contribution.planned;
    }
  }

  const themeLiquidated = new Map<ThemeBudget, number>();
  for (const entry of agg.values()) {
    themeLiquidated.set(entry.theme, (themeLiquidated.get(entry.theme) ?? 0) + entry.liquidated);
  }

  const rows: AxisExecutionRow[] = [];

  for (const theme of THEMES) {
    const catalog =
      (dimension === 'axis' ? metadata?.axes[theme] : metadata?.classifications[theme]) ?? [];
    const axisCatalog = new Map<string, string>();
    for (const ax of catalog) {
      axisCatalog.set(ax.value, ax.label);
    }
    for (const entry of agg.values()) {
      if (entry.theme !== theme) continue;
      if (!axisCatalog.has(entry.axis)) {
        axisCatalog.set(entry.axis, entry.axis);
      }
    }

    const axes =
      axisCatalog.size > 0
        ? [...axisCatalog.entries()]
        : [...agg.values()]
            .filter((e) => e.theme === theme)
            .map((e) => [e.axis, e.axis] as const);

    for (const [axis, axisLabel] of axes) {
      const entry = agg.get(`${theme}:${axis}`);
      const liquidated = entry?.liquidated ?? 0;
      const planned = entry?.planned ?? 0;
      const actionsCount = entry?.actionIds.size ?? 0;
      const themeTotal = themeLiquidated.get(theme) ?? 0;

      rows.push({
        theme,
        axis,
        axisLabel,
        actionsCount,
        liquidated,
        planned,
        pctOfTheme: themeTotal > 0 ? (liquidated / themeTotal) * 100 : 0,
        executionPct: planned > 0 ? Math.min((liquidated / planned) * 100, 100) : 0,
      });
    }
  }

  return rows;
}

export function buildAxisExecutionReport(
  actions: BudgetAction[],
  metadata: Metadata | null,
  executedByAssignment?: Map<string, number>,
): AxisExecutionRow[] {
  return buildExecutionReport(actions, metadata, 'axis', executedByAssignment);
}

export function buildClassificationExecutionReport(
  actions: BudgetAction[],
  metadata: Metadata | null,
  executedByAssignment?: Map<string, number>,
): AxisExecutionRow[] {
  return buildExecutionReport(actions, metadata, 'classification', executedByAssignment);
}

export function sortAxisRowsForDisplay(rows: AxisExecutionRow[]): AxisExecutionRow[] {
  return [...rows].sort((a, b) => {
    if (b.liquidated !== a.liquidated) return b.liquidated - a.liquidated;
    return a.axisLabel.localeCompare(b.axisLabel, 'pt-BR');
  });
}

export function filterAxisRowsWithData(rows: AxisExecutionRow[]): AxisExecutionRow[] {
  return rows.filter((row) => row.actionsCount > 0);
}

export function filterAxisRowsForChart(rows: AxisExecutionRow[]): AxisExecutionRow[] {
  return filterAxisRowsWithData(rows);
}

export function filterAxisReportByTheme(
  rows: AxisExecutionRow[],
  theme: ThemeBudget,
): AxisExecutionRow[] {
  return rows.filter((row) => row.theme === theme);
}

export function themeAxisTotals(
  rows: AxisExecutionRow[],
  theme: ThemeBudget,
  actions?: BudgetAction[],
) {
  const themeRows = filterAxisReportByTheme(rows, theme);
  const liquidated = themeRows.reduce((sum, row) => sum + row.liquidated, 0);
  const planned = themeRows.reduce((sum, row) => sum + row.planned, 0);
  const actionsCount =
    actions != null
      ? actions.filter((action) => action.assignments.some((asgn) => asgn.theme === theme)).length
      : themeRows.reduce((sum, row) => sum + row.actionsCount, 0);
  const executionPct = planned > 0 ? Math.min((liquidated / planned) * 100, 100) : 0;
  return { actionsCount, liquidated, planned, executionPct };
}

export function toFlatChartRows(rows: AxisExecutionRow[]): FlatThematicChartRow[] {
  return rows.map((row) => ({
    theme: row.theme,
    axis: row.axis,
    liquidated: row.liquidated,
    themeLabel: themeLabels[row.theme],
    axisLabel: row.axisLabel,
  }));
}
