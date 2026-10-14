import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataReferenceBadge,
} from 'orcamentos-tematicos';

const vigente2026 = {
  id: 'imp-2026-09',
  filename: 'QDD_SICAF_2026-09-18.xlsx',
  year: 2026,
  referenceMonth: 9,
  periodType: 'ACUMULADO_ANUAL' as const,
  importedAt: '2026-09-18T15:00:00Z',
  rowCount: 18432,
  actionCount: 1287,
  status: 'VIGENTE' as const,
};

const encerrado2025 = {
  ...vigente2026,
  id: 'imp-2025-12',
  filename: 'QDD_SICAF_2025-12-31.xlsx',
  year: 2025,
  referenceMonth: 12,
  importedAt: '2025-12-31T15:00:00Z',
  rowCount: 17905,
  actionCount: 1241,
};

// No app o indicador sempre fica numa linha flex (CardAction / barra de ferramentas),
// que o encolhe ao conteúdo; solto num bloco ele ocuparia a largura inteira.
export const Padrao = () => (
  <div className="flex">
    <DataReferenceBadge vigenteImport={vigente2026} />
  </div>
);

export const NoCabecalhoDoCartao = () => (
  <Card style={{ width: '44rem' }}>
    <CardHeader>
      <CardTitle>Ações programadas</CardTitle>
      <CardDescription>Todas as secretarias com ações marcadas nos três orçamentos temáticos.</CardDescription>
      <CardAction>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DataReferenceBadge vigenteImport={vigente2026} />
        </div>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">1.287</span> ações no recorte atual
      </p>
    </CardContent>
  </Card>
);

export const ExercicioAnterior = () => (
  <div className="flex">
    <DataReferenceBadge vigenteImport={encerrado2025} />
  </div>
);
