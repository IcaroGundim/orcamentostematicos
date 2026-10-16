import { describe, expect, it } from 'vitest';
import {
  aggregateBudgetChangesByOrganization,
  isPayrollAction,
  payrollBudgetTotalsOf,
  totalsOf,
} from './execution-monitor';
import type { BudgetAction, ExpenseLine } from '@/types/domain';

type Values = Pick<ExpenseLine, 'initialBudget' | 'updatedBudget'>;

function line(organizationCode: string, values: Values): ExpenseLine {
  return {
    id: `${organizationCode}-${values.initialBudget}-${values.updatedBudget}`,
    organizationCode,
    organizationName: `ÓRGÃO ${organizationCode}`,
    unitCode: '001',
    unitName: 'UNIDADE GESTORA',
    application: 'AÇÃO',
    functionalProgram: '',
    projectActivity: '20000000',
    expenseAccount: '3 3 90 30 00 00',
    expenseDescription: 'MATERIAL DE CONSUMO',
    reduced: '',
    source: '15000100',
    initialBudget: values.initialBudget,
    supplemented: values.updatedBudget - values.initialBudget,
    updatedBudget: values.updatedBudget,
    committed: 0,
    liquidated: 0,
    payableToLiquidate: 0,
    paid: 0,
    payable: 0,
    available: values.updatedBudget,
  };
}

function action(organizationCode: string, lines: Values[]): BudgetAction {
  const expenseLines = lines.map((values) => line(organizationCode, values));
  const sum = (key: keyof Values) => expenseLines.reduce((total, item) => total + item[key], 0);
  return {
    id: `acao-${organizationCode}`,
    year: 2026,
    organizationCode,
    organizationName: `ÓRGÃO ${organizationCode}`,
    unitCode: '001',
    unitName: 'UNIDADE GESTORA',
    application: 'AÇÃO',
    functionalProgram: '',
    projectActivity: '20000000',
    totals: {
      initialBudget: sum('initialBudget'),
      supplemented: sum('updatedBudget') - sum('initialBudget'),
      updatedBudget: sum('updatedBudget'),
      committed: 0,
      liquidated: 0,
      paid: 0,
      available: sum('updatedBudget'),
    },
    expenseLinesCount: expenseLines.length,
    expenseLines,
    assignments: [],
  } as BudgetAction;
}

describe('aggregateBudgetChangesByOrganization', () => {
  const actions = [
    // Crédito numa linha, anulação noutra: os dois fluxos aparecem e o saldo é exato.
    action('101', [
      { initialBudget: 1000, updatedBudget: 1500 },
      { initialBudget: 800, updatedBudget: 600 },
    ]),
    // Órgão que só perdeu dotação: precisa aparecer, com acréscimo zero.
    action('102', [{ initialBudget: 500, updatedBudget: 300 }]),
    // Órgão sem alteração.
    action('203', [{ initialBudget: 700, updatedBudget: 700 }]),
  ];
  const rows = aggregateBudgetChangesByOrganization(actions);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  it('separa acréscimos e reduções linha a linha, com o saldo líquido exato', () => {
    expect(byKey['101']).toMatchObject({ increases: 500, reductions: -200, netChange: 300, count: 2 });
    expect(byKey['102']).toMatchObject({ increases: 0, reductions: -200, netChange: -200 });
    expect(byKey['203']).toMatchObject({ increases: 0, reductions: 0, netChange: 0 });
  });

  it('fecha com atualizada − inicial do recorte (nada some, nada duplica)', () => {
    const totals = totalsOf(actions);
    const net = rows.reduce((total, row) => total + row.netChange, 0);
    expect(net).toBe(totals.updatedBudget - totals.initialBudget);
    for (const row of rows) expect(row.increases + row.reductions).toBe(row.netChange);
    expect(rows.reduce((total, row) => total + row.updatedBudget, 0)).toBe(totals.updatedBudget);
  });

  it('usa a sigla do órgão no eixo', () => {
    expect(byKey['101'].chartLabel).toBe('ALEAC');
  });
});

describe('payrollBudgetTotalsOf', () => {
  function payrollLine(account: string, updatedBudget: number, committed = 0): ExpenseLine {
    return { ...line('717', { initialBudget: updatedBudget, updatedBudget }), id: account, expenseAccount: account, committed };
  }
  const payroll = {
    ...action('717', []),
    id: 'folha',
    application: 'GESTÃO DA FOLHA DE PAGAMENTO DA SEE',
    expenseLines: [
      payrollLine('3 1 90 11 00 00', 1000, 400),
      payrollLine('3 1 90 13 00 00', 200, 80),
      payrollLine('3 1 90 34 00 00', 50, 50),
      payrollLine('3 3 90 36 00 00', 30, 30),
      payrollLine('sem natureza', 5),
    ],
  } as BudgetAction;
  const notPayroll = {
    ...action('717', [{ initialBudget: 900, updatedBudget: 900 }]),
    id: 'outra',
    application: 'MANUTENÇÃO DAS ESCOLAS',
  } as BudgetAction;

  it('soma só as ações de folha, sem os elementos 34 e 36', () => {
    const totals = payrollBudgetTotalsOf([payroll, notPayroll]);
    expect(totals.actionCount).toBe(1);
    expect(totals.updatedBudget).toBe(1205);
    expect(totals.committed).toBe(480);
    expect(totals.excludedUpdatedBudget).toBe(80);
  });

  it('reconhece a ação de folha sem depender de acento ou caixa', () => {
    expect(isPayrollAction({ application: 'Gestao da Folha de Pagamento - IEPTEC' })).toBe(true);
    expect(isPayrollAction({ application: 'PAGAMENTO DE BOLSAS' })).toBe(false);
  });

  it('recorte sem folha devolve zeros, não NaN', () => {
    expect(payrollBudgetTotalsOf([])).toMatchObject({ updatedBudget: 0, actionCount: 0, excludedUpdatedBudget: 0 });
  });
});
