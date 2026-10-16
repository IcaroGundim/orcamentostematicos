import { LiquidatedByAxisChart, chartHeightForRowCount } from 'orcamentos-tematicos';

type Row = {
  theme: 'OCAD' | 'OSG' | 'CLIMATICO';
  axis: string;
  liquidated: number;
  themeLabel: string;
  axisLabel: string;
};

// Eixos e classificações do catálogo real (`/api/metadata`), exercício 2026.
// O painel "Execução por eixo" é por tema: cada gráfico tem um único tema, logo uma cor.
const ocadPorEixo: Row[] = [
  { theme: 'OCAD', axis: 'EDUCACAO', axisLabel: 'Educação', themeLabel: 'OCAD', liquidated: 198_340_115.2 },
  { theme: 'OCAD', axis: 'SAUDE', axisLabel: 'Saúde', themeLabel: 'OCAD', liquidated: 76_902_418.35 },
  {
    theme: 'OCAD',
    axis: 'ASSISTENCIA_SOCIAL',
    axisLabel: 'Assistência Social',
    themeLabel: 'OCAD',
    liquidated: 37_238_381.82,
  },
];

const climaticoPorEixo: Row[] = [
  ['DESENVOLVIMENTO_SUSTENTAVEL_BIOECONOMIA', 'Desenvolvimento sustentável e bioeconomia', 52_118_400],
  ['MITIGACAO', 'Mitigação das mudanças climáticas', 38_902_115.6],
  ['ADAPTACAO', 'Adaptação climática', 34_560_227.3],
  ['GESTAO_RISCOS_PROTECAO_CIVIL', 'Gestão de riscos e proteção civil', 27_415_980.45],
  ['GOVERNANCA_AMBIENTAL_TRANSPARENCIA', 'Governança ambiental e transparência', 16_230_118.75],
  ['JUSTICA_CLIMATICA_INCLUSAO_SOCIAL', 'Justiça climática e inclusão social', 11_487_560],
  ['EDUCACAO_AMBIENTAL_INOVACAO', 'Educação ambiental e inovação', 7_201_000],
].map(([axis, axisLabel, liquidated]) => ({
  theme: 'CLIMATICO' as const,
  axis: axis as string,
  axisLabel: axisLabel as string,
  themeLabel: 'Climático',
  liquidated: liquidated as number,
}));

const osgPorClassificacao: Row[] = [
  ['CATEGORIA_2', 'Categoria 2 - Não exclusivo (Previsto no PPA)', 48_730_560.14],
  ['CATEGORIA_3', 'Categoria 3 - Não exclusivo (Não previsto no PPA)', 26_177_550.2],
  ['CATEGORIA_1', 'Categoria 1 - Exclusivo para mulheres', 21_402_118.3],
].map(([axis, axisLabel, liquidated]) => ({
  theme: 'OSG' as const,
  axis: axis as string,
  axisLabel: axisLabel as string,
  themeLabel: 'OSG',
  liquidated: liquidated as number,
}));

/** Coluna do gráfico no painel "Execução por eixo" (altura calculada como no painel). */
const ColunaDoGrafico = ({ title, data }: { title: string; data: Row[] }) => (
  <div className="flex min-w-0 flex-col gap-2" style={{ width: '44rem' }}>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <LiquidatedByAxisChart
      data={data}
      layout="horizontal"
      height={Math.max(chartHeightForRowCount(data.length), 280)}
      autoHeight={false}
    />
  </div>
);

export const PorEixoOcad = () => <ColunaDoGrafico title="Valor liquidado por eixo" data={ocadPorEixo} />;

export const PorEixoClimatico = () => (
  <ColunaDoGrafico title="Valor liquidado por eixo" data={climaticoPorEixo} />
);

export const PorClassificacaoOsg = () => (
  <ColunaDoGrafico title="Valor liquidado por classificação" data={osgPorClassificacao} />
);

export const SemDados = () => <ColunaDoGrafico title="Valor liquidado por eixo" data={[]} />;
