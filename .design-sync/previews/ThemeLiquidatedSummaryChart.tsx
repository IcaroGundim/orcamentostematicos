import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ThemeLiquidatedSummaryChart,
} from 'orcamentos-tematicos';

// `Summary['totalsByTheme']` do exercício 2026 — liquidado das ações classificadas.
const totalsByTheme = [
  { theme: 'OCAD' as const, actions: 142, liquidated: 312_480_915.37 },
  { theme: 'OSG' as const, actions: 61, liquidated: 96_310_228.64 },
  { theme: 'CLIMATICO' as const, actions: 88, liquidated: 187_915_402.1 },
];

// Primeiro bimestre: o OSG ainda não liquidou nada nas ações classificadas.
const inicioDoExercicio = [
  { theme: 'OCAD' as const, actions: 139, liquidated: 41_207_388.52 },
  { theme: 'OSG' as const, actions: 58, liquidated: 0 },
  { theme: 'CLIMATICO' as const, actions: 84, liquidated: 18_904_117.3 },
];

type Row = { theme: 'OCAD' | 'OSG' | 'CLIMATICO'; actions: number; liquidated: number };

/** Mesmo cartão de "Relatórios › Visão geral" da SEPLAN. */
const ResumoPorTema = ({ data }: { data: Row[] }) => (
  <Card className="flex flex-col" style={{ width: '28rem' }}>
    <CardHeader>
      <CardTitle>Resumo por tema</CardTitle>
      <CardDescription>Valores liquidados das ações classificadas por orçamento temático.</CardDescription>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <div style={{ width: '100%', height: '17rem' }}>
        <ThemeLiquidatedSummaryChart data={data} />
      </div>
    </CardContent>
  </Card>
);

export const Padrao = () => <ResumoPorTema data={totalsByTheme} />;

export const InicioDoExercicio = () => <ResumoPorTema data={inicioDoExercicio} />;

export const SemValores = () => <ResumoPorTema data={[]} />;
