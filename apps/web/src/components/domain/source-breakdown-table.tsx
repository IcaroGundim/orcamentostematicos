'use client';

import { useMemo } from 'react';
import { formatMoney } from '@/lib/api';
import { getFonteLabel } from '@/lib/fontes-recursos';
import type { BudgetAction, ExpenseLine } from '@/types/domain';

export type SourceBreakdownTableProps = {
  action: BudgetAction | null;
};

type SourceRow = {
  source: string;
  initialBudget: number;
  updatedBudget: number;
  liquidated: number;
};

export function SourceBreakdownTable({ action }: SourceBreakdownTableProps) {
  const rows = useMemo<SourceRow[]>(() => {
    const lines = action?.expenseLines ?? [];
    const map = new Map<string, SourceRow>();
    for (const line of lines as ExpenseLine[]) {
      const key = line.source?.trim() || 'Sem fonte';
      const current = map.get(key) ?? {
        source: key,
        initialBudget: 0,
        updatedBudget: 0,
        liquidated: 0,
      };
      current.initialBudget += line.initialBudget ?? 0;
      current.updatedBudget += line.updatedBudget ?? 0;
      current.liquidated += line.liquidated ?? 0;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => a.source.localeCompare(b.source, 'pt-BR'));
  }, [action]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          initialBudget: acc.initialBudget + row.initialBudget,
          updatedBudget: acc.updatedBudget + row.updatedBudget,
          liquidated: acc.liquidated + row.liquidated,
        }),
        { initialBudget: 0, updatedBudget: 0, liquidated: 0 },
      ),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Sem linhas de despesa carregadas para esta ação.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-muted/30">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Fonte</th>
            <th className="px-3 py-2 text-right font-semibold">Inicial</th>
            <th className="px-3 py-2 text-right font-semibold">Atualizado</th>
            <th className="px-3 py-2 text-right font-semibold">Liquidado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const label = getFonteLabel(row.source);
            return (
              <tr key={row.source} className="border-t border-border/60">
                <td className="px-3 py-1.5">
                  <span className="font-medium tabular-nums">{row.source}</span>
                  {label ? (
                    <span className="ml-2 text-muted-foreground">{label}</span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(row.initialBudget)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(row.updatedBudget)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(row.liquidated)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.initialBudget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.updatedBudget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.liquidated)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
