'use client';

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMoney } from '@/lib/api';
import { buildExpenseRows } from '@/lib/expense-breakdown';
import { getFonteLabel } from '@/lib/fontes-recursos';
import type { BudgetAction } from '@/types/domain';

const EMPTY_KEYS: ReadonlySet<string> = new Set();

export type ExpenseBreakdownTableProps = {
  action: BudgetAction | null;
  /** Modo Somar: exibe checkboxes para selecionar linhas. */
  selectable?: boolean;
  /** Ação inteira selecionada (todas as linhas). */
  allSelected?: boolean;
  /** Chaves de linha selecionadas individualmente (seleção parcial). */
  selectedLineKeys?: ReadonlySet<string>;
  onToggleLine?: (lineKey: string) => void;
  onToggleAll?: () => void;
};

export function ExpenseBreakdownTable({
  action,
  selectable = false,
  allSelected = false,
  selectedLineKeys = EMPTY_KEYS,
  onToggleLine,
  onToggleAll,
}: ExpenseBreakdownTableProps) {
  const rows = useMemo(() => buildExpenseRows(action), [action]);

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
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-400">
        Sem linhas de despesa carregadas para esta ação.
      </div>
    );
  }

  const headerChecked = allSelected ? true : selectedLineKeys.size > 0 ? 'indeterminate' : false;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/50">
      <table className="w-full text-sm text-neutral-900 dark:text-neutral-100">
        <thead className="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          <tr>
            {selectable ? (
              <th className="w-8 px-3 py-2 text-center align-middle">
                <Checkbox
                  className="mx-auto size-4"
                  checked={headerChecked}
                  onCheckedChange={() => onToggleAll?.()}
                  aria-label="Selecionar todas as linhas de despesa"
                />
              </th>
            ) : null}
            <th className="px-3 py-2 text-left font-semibold">Conta</th>
            <th className="px-3 py-2 text-left font-semibold">Descrição</th>
            <th className="px-3 py-2 text-left font-semibold">Fonte</th>
            <th className="px-3 py-2 text-right font-semibold">Inicial</th>
            <th className="px-3 py-2 text-right font-semibold">Atualizado</th>
            <th className="px-3 py-2 text-right font-semibold">Liquidado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fonteLabel = getFonteLabel(row.source);
            const checked = allSelected || selectedLineKeys.has(row.key);
            return (
              <tr
                key={row.key}
                data-state={selectable && checked ? 'selected' : undefined}
                onClick={selectable ? () => onToggleLine?.(row.key) : undefined}
                className={`border-t border-neutral-200 dark:border-neutral-700 ${
                  selectable ? 'cursor-pointer data-[state=selected]:bg-primary/5' : ''
                }`}
              >
                {selectable ? (
                  <td
                    className="w-8 px-3 py-1.5 text-center align-top"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      className="mx-auto size-4"
                      checked={checked}
                      onCheckedChange={() => onToggleLine?.(row.key)}
                      aria-label={`Selecionar ${row.expenseAccount}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-1.5 align-top tabular-nums whitespace-nowrap font-medium">
                  {row.expenseAccount}
                </td>
                <td className="px-3 py-1.5 align-top">{row.expenseDescription}</td>
                <td className="px-3 py-1.5 align-top">
                  <span className="font-medium tabular-nums">{row.source}</span>
                  {fonteLabel ? (
                    <span className="ml-2 text-neutral-600 dark:text-neutral-400">{fonteLabel}</span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-right align-top tabular-nums">{formatMoney(row.initialBudget)}</td>
                <td className="px-3 py-1.5 text-right align-top tabular-nums">{formatMoney(row.updatedBudget)}</td>
                <td className="px-3 py-1.5 text-right align-top tabular-nums">{formatMoney(row.liquidated)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200 bg-neutral-100 font-semibold dark:border-neutral-700 dark:bg-neutral-800">
            <td className="px-3 py-2" colSpan={selectable ? 4 : 3}>Total</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.initialBudget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.updatedBudget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.liquidated)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
