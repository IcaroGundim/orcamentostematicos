import { SourceBreakdownTable } from 'orcamentos-tematicos';

const base = {
  organizationCode: '717',
  organizationName: 'SECRETARIA DE ESTADO DA EDUCAÇÃO, CULTURA E ESPORTES - SEE',
  unitCode: '001',
  unitName: 'UNIDADE GESTORA',
  application: 'MELHORIA, MODERNIZAÇÃO E INOVAÇÃO DA REDE ESTADUAL DE ENSINO.',
  functionalProgram: '12362101010400000',
  projectActivity: '10400000',
  expenseAccount: '3.3.90.39',
  expenseDescription: 'Outros Serviços de Terceiros - Pessoa Jurídica',
  reduced: '',
  supplemented: 0,
  committed: 0,
  payableToLiquidate: 0,
  paid: 0,
  payable: 0,
  available: 0,
};

const line = (id: string, source: string, initialBudget: number, updatedBudget: number, liquidated: number) => ({
  ...base,
  id,
  reduced: id,
  source,
  initialBudget,
  updatedBudget,
  liquidated,
});

const action = {
  id: 'acao-10400000',
  year: 2026,
  organizationCode: base.organizationCode,
  organizationName: base.organizationName,
  unitCode: base.unitCode,
  unitName: base.unitName,
  application: base.application,
  functionalProgram: base.functionalProgram,
  projectActivity: base.projectActivity,
  totals: {
    initialBudget: 41_800_000,
    supplemented: 6_512_900,
    updatedBudget: 48_312_900,
    committed: 39_880_210.5,
    liquidated: 31_074_518.42,
    paid: 29_950_100.1,
    available: 8_432_689.5,
  },
  expenseLinesCount: 4,
  expenseLines: [
    line('l1', '15001001', 18_500_000, 21_200_000, 14_830_117.3),
    line('l2', '15400300', 15_300_000, 17_812_900, 11_904_221.12),
    line('l3', '15500102', 5_000_000, 6_300_000, 3_720_180),
    line('l4', '15703110', 3_000_000, 3_000_000, 620_000),
  ],
  assignments: [],
};

export const PorFonte = () => (
  <div className="w-[44rem]">
    <SourceBreakdownTable action={action} />
  </div>
);

export const SemLinhas = () => (
  <div className="w-[44rem]">
    <SourceBreakdownTable action={{ ...action, expenseLines: [], expenseLinesCount: 0 }} />
  </div>
);
