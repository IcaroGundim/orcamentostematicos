import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ScrollArea,
  ScrollBar,
} from 'orcamentos-tematicos';

const revisions = [
  { id: 'r1', source: 'SICAF', period: 'Jan–09/2026', at: '26/09/2026 07:12:44', file: 'QDD_Saldo_Retroativo_2026-09-26.xlsx', actions: 1284, rows: 6917, by: 'Coleta automática' },
  { id: 'r2', source: 'SICAF', period: 'Jan–09/2026', at: '25/09/2026 07:10:03', file: 'QDD_Saldo_Retroativo_2026-09-25.xlsx', actions: 1283, rows: 6902, by: 'Coleta automática' },
  { id: 'r3', source: 'Manual', period: 'Jan–08/2026', at: '18/09/2026 16:41:27', file: 'QDD_Agosto_2026_revisado.xlsx', actions: 1281, rows: 6874, by: 'Administrador SEPLAN' },
  { id: 'r4', source: 'SICAF', period: 'Jan–08/2026', at: '12/09/2026 07:09:51', file: 'QDD_Saldo_Retroativo_2026-09-12.xlsx', actions: 1279, rows: 6860, by: 'Coleta automática' },
  { id: 'r5', source: 'Migrada', period: 'Jan–07/2026', at: '14/08/2026 10:02:18', file: 'QDD_Julho_2026.xlsx', actions: 1266, rows: 6781, by: 'Migração' },
  { id: 'r6', source: 'Manual', period: 'Jan–06/2026', at: '15/07/2026 09:30:55', file: 'QDD_Junho_2026.xlsx', actions: 1259, rows: 6712, by: 'Administrador SEPLAN' },
];

export const HistoricoDeAtualizacoes = () => (
  <Card className="w-[34rem]">
    <CardHeader>
      <CardTitle>Atualizações da base</CardTitle>
      <CardDescription>
        Histórico leve do exercício selecionado, sem cópias das ações e linhas antigas.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ScrollArea type="always" className="max-h-80">
        <div className="flex flex-col gap-2 pr-3">
          {revisions.map((revision) => (
            <div key={revision.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{revision.source}</Badge>
                <span className="font-medium">{revision.period}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{revision.at}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{revision.file}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {revision.actions.toLocaleString('pt-BR')} ações · {revision.rows.toLocaleString('pt-BR')} linhas ·{' '}
                {revision.by}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
);

const units = [
  '071001 — Secretaria de Estado de Educação',
  '071002 — Instituto Dom Moacyr',
  '081001 — Secretaria de Estado de Saúde',
  '081002 — Fundação Hospitalar do Acre',
  '111001 — Secretaria de Estado de Meio Ambiente',
  '111002 — Instituto de Mudanças Climáticas',
  '121001 — Secretaria de Estado de Assistência Social',
  '131001 — Secretaria de Estado da Mulher',
  '141001 — Secretaria de Estado de Planejamento',
  '151001 — Secretaria de Estado de Agricultura',
];

export const ListaDeUnidades = () => (
  <div className="w-[26rem] border border-black/70 bg-white">
    <ScrollArea type="always" style={{ height: '14rem' }}>
      <ul className="flex flex-col">
        {units.map((unit) => (
          <li key={unit} className="border-b border-black/20 px-3 py-2 text-sm tabular-nums">
            {unit}
          </li>
        ))}
      </ul>
    </ScrollArea>
  </div>
);

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const liquidated = ['18,4 mi', '21,9 mi', '24,1 mi', '22,7 mi', '26,3 mi', '25,8 mi', '27,2 mi', '28,9 mi', '19,6 mi', '—', '—', '—'];

export const Horizontal = () => (
  <div className="w-[26rem] border border-black/70 bg-white">
    <ScrollArea type="always" className="w-full">
      <div className="flex w-max">
        {months.map((month, index) => (
          <div key={month} className="flex w-24 shrink-0 flex-col gap-1 border-r border-black/20 px-3 py-2.5">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {month}/2026
            </span>
            <span className="text-sm font-semibold tabular-nums">{liquidated[index]}</span>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);
