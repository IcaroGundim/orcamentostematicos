import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ClassificationLiquidatedSummaryChart,
} from 'orcamentos-tematicos';

type Row = {
  theme: 'OCAD' | 'OSG' | 'CLIMATICO';
  classification: string;
  actions: number;
  liquidated: number;
};

// `Summary['totalsByClassification']` do exercício 2026. As classificações de cada tema
// somam o total do tema (OCAD R$ 312,5 mi · OSG R$ 96,3 mi · Climático R$ 187,9 mi).
const totalsByClassification: Row[] = [
  { theme: 'OCAD', classification: 'EXCLUSIVO', actions: 97, liquidated: 221_604_310.12 },
  { theme: 'OCAD', classification: 'NAO_EXCLUSIVO', actions: 45, liquidated: 90_876_605.25 },
  { theme: 'OSG', classification: 'CATEGORIA_1', actions: 14, liquidated: 21_402_118.3 },
  { theme: 'OSG', classification: 'CATEGORIA_2', actions: 29, liquidated: 48_730_560.14 },
  { theme: 'OSG', classification: 'CATEGORIA_3', actions: 18, liquidated: 26_177_550.2 },
  { theme: 'CLIMATICO', classification: 'EXCLUSIVA', actions: 31, liquidated: 64_220_871.45 },
  { theme: 'CLIMATICO', classification: 'INDIRETA', actions: 57, liquidated: 123_694_530.65 },
];

// Recorte com só o OCAD marcado (curadoria dos outros temas ainda não feita).
const apenasOcad: Row[] = totalsByClassification.filter((row) => row.theme === 'OCAD');

/** Mesmo cartão de "Relatórios › Visão geral" da SEPLAN. */
const ResumoPorClassificacao = ({ data, height }: { data: Row[]; height: string }) => (
  <Card className="flex flex-col" style={{ width: '28rem' }}>
    <CardHeader>
      <CardTitle>Resumo por classificação</CardTitle>
      <CardDescription>Valores liquidados por classificação dentro de cada orçamento temático.</CardDescription>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <div style={{ width: '100%', height }}>
        <ClassificationLiquidatedSummaryChart data={data} />
      </div>
    </CardContent>
  </Card>
);

export const Padrao = () => <ResumoPorClassificacao data={totalsByClassification} height="30rem" />;

export const ApenasOcad = () => <ResumoPorClassificacao data={apenasOcad} height="18rem" />;

export const SemValores = () => <ResumoPorClassificacao data={[]} height="13rem" />;
