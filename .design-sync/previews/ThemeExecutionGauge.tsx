import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ThemeExecutionGauge,
} from 'orcamentos-tematicos';

/**
 * Rampa do arco em 6 faixas — cópia literal de `gaugeColor` em `app/seplan/page.tsx`.
 * Os tokens --color-gauge-1..6 vão de vermelho (execução baixa) a verde escuro (alta).
 */
function gaugeColor(pct: number): string {
  if (pct >= 90) return 'var(--color-gauge-6)';
  if (pct >= 75) return 'var(--color-gauge-5)';
  if (pct >= 60) return 'var(--color-gauge-4)';
  if (pct >= 40) return 'var(--color-gauge-3)';
  if (pct >= 20) return 'var(--color-gauge-2)';
  return 'var(--color-gauge-1)';
}

const formatPct = (pct: number) =>
  `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type GaugeItem = {
  theme: string;
  label: string;
  liquidated: string;
  planned: string;
  pct: number;
};

/** Bloco de um tema, como em "Execução dos orçamentos temáticos" (Relatórios da SEPLAN). */
const GaugeBlock = ({ theme, label, liquidated, planned, pct }: GaugeItem) => (
  <div className="flex flex-col items-center gap-2">
    <div className="relative mx-auto w-[220px]">
      <ThemeExecutionGauge pct={pct} color={gaugeColor(pct)} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <p className="text-2xl font-bold tabular-nums">{formatPct(pct)}</p>
      </div>
    </div>
    <div className="flex w-max min-w-[220px] max-w-full flex-col items-center gap-0.5 px-1 text-center">
      <p className="text-sm font-semibold leading-none">{theme}</p>
      <p className="max-w-[220px] text-xs text-muted-foreground leading-snug">{label}</p>
      <p className="mt-1 max-w-full overflow-x-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {liquidated} / {planned}
      </p>
    </div>
  </div>
);

// Execução = liquidado sobre a dotação inicial ponderada de cada tema (exercício 2026).
const themes: GaugeItem[] = [
  {
    theme: 'OSG',
    label: 'Orçamento Sensível ao Gênero',
    liquidated: 'R$ 17.874.312,40',
    planned: 'R$ 96.105.880,00',
    pct: 18.6,
  },
  {
    theme: 'OCAD',
    label: 'Orçamento Criança e Adolescente',
    liquidated: 'R$ 164.220.518,90',
    planned: 'R$ 313.402.117,00',
    pct: 52.4,
  },
  {
    theme: 'CLIMATICO',
    label: 'Orçamento do Clima',
    liquidated: 'R$ 171.080.940,15',
    planned: 'R$ 187.915.300,00',
    pct: 91.0,
  },
];

export const Padrao = () => (
  <GaugeBlock
    theme="OCAD"
    label="Orçamento Criança e Adolescente"
    liquidated="R$ 201.517.561,23"
    planned="R$ 313.402.117,00"
    pct={64.3}
  />
);

export const ExecucaoPorTema = () => (
  <Card style={{ width: '54rem' }}>
    <CardHeader>
      <CardTitle>Execução dos orçamentos temáticos</CardTitle>
      <CardDescription>Percentual de execução por tema — liquidado sobre a dotação inicial.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-3 gap-6">
        {themes.map((item) => (
          <GaugeBlock key={item.theme} {...item} />
        ))}
      </div>
    </CardContent>
  </Card>
);

const faixas = [
  { pct: 12.5, faixa: 'Abaixo de 20%' },
  { pct: 31.2, faixa: 'De 20% a 39%' },
  { pct: 48.7, faixa: 'De 40% a 59%' },
  { pct: 67.9, faixa: 'De 60% a 74%' },
  { pct: 82.4, faixa: 'De 75% a 89%' },
  { pct: 95.1, faixa: '90% ou mais' },
];

export const FaixasDeExecucao = () => (
  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
    {faixas.map(({ pct, faixa }) => (
      <div key={faixa} className="flex flex-col items-center gap-1">
        <div className="relative mx-auto w-[220px]">
          <ThemeExecutionGauge pct={pct} color={gaugeColor(pct)} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <p className="text-2xl font-bold tabular-nums">{formatPct(pct)}</p>
          </div>
        </div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {faixa}
        </p>
      </div>
    ))}
  </div>
);

export const SemExecucao = () => (
  <GaugeBlock
    theme="OSG"
    label="Orçamento Sensível ao Gênero"
    liquidated="R$ 0,00"
    planned="R$ 96.105.880,00"
    pct={0}
  />
);
