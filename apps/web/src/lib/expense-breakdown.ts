import type { BudgetAction, ExpenseLine } from '@/types/domain';

export type ExpenseRow = {
  key: string;
  expenseAccount: string;
  expenseDescription: string;
  source: string;
  initialBudget: number;
  updatedBudget: number;
  liquidated: number;
};

/**
 * Limpa descrições de despesa truncadas na origem (QDD). Remove uma cauda
 * incompleta no fim que termina em hífen, ex: "OUTROS SERVIÇOS DE TERCEIROS -
 * PES-" → "OUTROS SERVIÇOS DE TERCEIROS". Descrições completas não são afetadas.
 */
export function cleanExpenseDescription(description: string): string {
  return description
    .trim()
    .replace(/\s*-\s*[^\s-]*-\s*$/, '')
    .replace(/[\s-]+$/, '')
    .trim();
}

/**
 * Agrega as linhas de despesa de uma ação por (conta + fonte), somando
 * Inicial/Atualizado/Liquidado. A chave `${conta}||${fonte}` é estável e usada
 * tanto na exibição quanto na seleção do modo Somar.
 */
export function buildExpenseRows(action: BudgetAction | null): ExpenseRow[] {
  const lines = action?.expenseLines ?? [];
  const map = new Map<string, ExpenseRow>();
  for (const line of lines as ExpenseLine[]) {
    const account = line.expenseAccount?.trim() || 'Sem conta';
    const source = line.source?.trim() || 'Sem fonte';
    const key = `${account}||${source}`;
    const current = map.get(key) ?? {
      key,
      expenseAccount: account,
      expenseDescription: cleanExpenseDescription(line.expenseDescription ?? '') || '—',
      source,
      initialBudget: 0,
      updatedBudget: 0,
      liquidated: 0,
    };
    current.initialBudget += line.initialBudget ?? 0;
    current.updatedBudget += line.updatedBudget ?? 0;
    current.liquidated += line.liquidated ?? 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => {
    const byAccount = a.expenseAccount.localeCompare(b.expenseAccount, 'pt-BR');
    return byAccount !== 0 ? byAccount : a.source.localeCompare(b.source, 'pt-BR');
  });
}
