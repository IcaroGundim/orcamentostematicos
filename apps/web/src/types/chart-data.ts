import { ThemeBudget } from './domain';

// Proposed data structure for charts showing thematic budgets (orçamentos temáticos),
// their axes (eixos), and liquidated values (valores liquidados).
// Suitable for Recharts BarChart (grouped/stacked by theme+axis), PieChart per theme, or Treemap.

export interface ThematicAxisValue {
  axis: string;           // e.g. 'Educacao', 'Saude', 'Infraestrutura'
  label: string;          // human readable
  liquidated: number;     // valor liquidado in R$
  actionsCount: number;
}

export interface ThematicBudgetChartData {
  theme: ThemeBudget;
  themeLabel: string;
  totalLiquidated: number;
  totalActions: number;
  axes: ThematicAxisValue[];
  // Optional: for drill-down or percentage
  percentageOfTotal?: number;
}

// Mock data example (realistic scale for Acre state thematic budgets ~2025/2026)
export const mockThematicChartData: ThematicBudgetChartData[] = [
  {
    theme: 'OCAD',
    themeLabel: 'Orçamento da Criança e do Adolescente (OCAD)',
    totalLiquidated: 124500000,
    totalActions: 87,
    axes: [
      { axis: 'Educacao', label: 'Educação e Ensino', liquidated: 68200000, actionsCount: 34 },
      { axis: 'Saude', label: 'Saúde e Nutrição', liquidated: 31200000, actionsCount: 22 },
      { axis: 'Protecao', label: 'Proteção Social e Direitos', liquidated: 15100000, actionsCount: 18 },
      { axis: 'Cultura', label: 'Cultura, Esporte e Lazer', liquidated: 9800000, actionsCount: 13 },
    ],
  },
  {
    theme: 'OSG',
    themeLabel: 'Orçamento Sensível ao Gênero (OSG)',
    totalLiquidated: 87300000,
    totalActions: 61,
    axes: [
      { axis: 'Empoderamento', label: 'Empoderamento Econômico e Autonomia', liquidated: 28900000, actionsCount: 19 },
      { axis: 'Saude', label: 'Saúde da Mulher e Direitos Reprodutivos', liquidated: 24100000, actionsCount: 15 },
      { axis: 'Violencia', label: 'Enfrentamento à Violência', liquidated: 18700000, actionsCount: 14 },
      { axis: 'Educacao', label: 'Educação e Formação Profissional', liquidated: 15600000, actionsCount: 13 },
    ],
  },
  {
    theme: 'CLIMATICO',
    themeLabel: 'Orçamento Climático',
    totalLiquidated: 156200000,
    totalActions: 94,
    axes: [
      { axis: 'Adaptacao', label: 'Adaptação e Resiliência Climática', liquidated: 67200000, actionsCount: 31 },
      { axis: 'Mitigacao', label: 'Mitigação e Redução de Emissões', liquidated: 45300000, actionsCount: 27 },
      { axis: 'Florestas', label: 'Florestas, Biodiversidade e REDD+', liquidated: 28900000, actionsCount: 22 },
      { axis: 'Agro', label: 'Agroecologia e Produção Sustentável', liquidated: 14700000, actionsCount: 14 },
    ],
  },
];

// Flat structure alternative (better for some Recharts visualizations like stacked bar)
export interface FlatThematicChartRow {
  theme: ThemeBudget;
  axis: string;
  liquidated: number;
  themeLabel: string;
  axisLabel: string;
}

export const mockFlatThematicData: FlatThematicChartRow[] = mockThematicChartData.flatMap((theme) =>
  theme.axes.map((ax) => ({
    theme: theme.theme,
    axis: ax.axis,
    liquidated: ax.liquidated,
    themeLabel: theme.themeLabel,
    axisLabel: ax.label,
  }))
);