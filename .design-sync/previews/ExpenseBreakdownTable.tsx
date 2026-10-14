import { useState } from 'react';
import { ExpenseBreakdownTable } from 'orcamentos-tematicos';

const base = {
  organizationCode: '0720',
  organizationName: 'Secretaria de Estado de Saúde',
  unitCode: '072002',
  unitName: 'Fundo Estadual de Saúde',
  application: 'Atenção Especializada em Média e Alta Complexidade',
  functionalProgram: '10.302.1020',
  projectActivity: '2210',
  reduced: '',
  supplemented: 0,
  committed: 0,
  payableToLiquidate: 0,
  paid: 0,
  payable: 0,
  available: 0,
};

const line = (
  id: string,
  expenseAccount: string,
  expenseDescription: string,
  source: string,
  initialBudget: number,
  updatedBudget: number,
  liquidated: number,
) => ({
  ...base,
  id,
  reduced: id,
  expenseAccount,
  expenseDescription,
  source,
  initialBudget,
  updatedBudget,
  liquidated,
});

const action = {
  id: 'acao-2210',
  year: 2026,
  organizationCode: base.organizationCode,
  organizationName: base.organizationName,
  unitCode: base.unitCode,
  unitName: base.unitName,
  application: base.application,
  functionalProgram: base.functionalProgram,
  projectActivity: base.projectActivity,
  totals: {
    initialBudget: 35_950_000,
    supplemented: 7_700_000,
    updatedBudget: 43_650_000,
    committed: 31_204_870.66,
    liquidated: 25_494_013.83,
    paid: 24_100_550.12,
    available: 12_445_129.34,
  },
  expenseLinesCount: 7,
  expenseLines: [
    line('4410', '3.3.90.30', 'Material de Consumo', '16000400', 12_400_000, 14_950_000, 9_812_430.18),
    line('4411', '3.3.90.30', 'Material de Consumo', '15001002', 6_000_000, 6_000_000, 4_105_220.4),
    // Duas reduzidas com a mesma conta + fonte: a tabela agrega numa linha só.
    line('4412', '3.3.90.39', 'Outros Serviços de Terceiros - Pessoa Jurídica', '16000400', 9_500_000, 10_200_000, 7_340_118.9),
    line('4418', '3.3.90.39', 'Outros Serviços de Terceiros - Pessoa Jurídica', '16000400', 3_200_000, 3_900_000, 2_615_004.35),
    line('4413', '3.3.90.36', 'Outros Serviços de Terceiros - Pessoa Física', '15001002', 850_000, 850_000, 412_300),
    line('4414', '4.4.90.52', 'Equipamentos e Material Permanente', '16010400', 4_000_000, 5_600_000, 1_208_940),
    // Emenda parlamentar incluída no exercício: sem dotação inicial, ainda sem liquidação.
    line('4431', '4.4.90.52', 'Equipamentos e Material Permanente', '16003110', 0, 2_150_000, 0),
  ],
  assignments: [],
};

export const Padrao = () => (
  <div style={{ width: '54rem' }}>
    <ExpenseBreakdownTable action={action} />
  </div>
);

/** Modo Somar do painel de ações programadas: seleção parcial deixa o cabeçalho indeterminado. */
export const ModoSomar = () => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(['3.3.90.30||16000400', '3.3.90.39||16000400']),
  );
  const [all, setAll] = useState(false);
  const toggleLine = (key: string) => {
    setAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    setAll((prev) => !prev);
    setSelected(new Set());
  };
  return (
    <div style={{ width: '54rem' }}>
      <ExpenseBreakdownTable
        action={action}
        selectable
        allSelected={all}
        selectedLineKeys={selected}
        onToggleLine={toggleLine}
        onToggleAll={toggleAll}
      />
    </div>
  );
};

export const TodasSelecionadas = () => (
  <div style={{ width: '54rem' }}>
    <ExpenseBreakdownTable action={action} selectable allSelected />
  </div>
);

export const SemLinhas = () => (
  <div style={{ width: '54rem' }}>
    <ExpenseBreakdownTable action={{ ...action, expenseLines: [], expenseLinesCount: 0 }} />
  </div>
);
