import { describe, expect, it } from 'vitest';
import { buildExpenseRows } from './expense-breakdown';
import type { BudgetAction } from '@/types/domain';

describe('buildExpenseRows', () => {
  it('soma todos os estágios por conta + fonte', () => {
    const line = (account: string, source: string, value: number) => ({
      expenseAccount: account,
      expenseDescription: 'OUTROS SERVIÇOS DE TERCEIROS',
      source,
      initialBudget: value,
      updatedBudget: value * 2,
      committed: value * 1.5,
      liquidated: value,
      paid: value / 2,
    });
    const action = {
      expenseLines: [line('3 3 90 39 00 00', '15000100', 100), line('3 3 90 39 00 00', '15000100', 50), line('3 3 90 30 00 00', '15000100', 10)],
    } as unknown as BudgetAction;
    const rows = buildExpenseRows(action);
    expect(rows).toHaveLength(2);
    const services = rows.find((row) => row.expenseAccount === '3 3 90 39 00 00')!;
    expect(services).toMatchObject({ initialBudget: 150, updatedBudget: 300, committed: 225, liquidated: 150, paid: 75 });
  });
});
