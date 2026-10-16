import { StatusBadge, ThemeBadge } from 'orcamentos-tematicos';

const rotulo = 'text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export const Todos = () => (
  <div className="flex flex-wrap items-start gap-6">
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status="RASCUNHO" />
      <span className={rotulo}>Em preenchimento</span>
    </div>
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status="ENVIADO" />
      <span className={rotulo}>Aguardando a SEPLAN</span>
    </div>
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status="DEVOLVIDO" />
      <span className={rotulo}>Devolvido pela SEPLAN</span>
    </div>
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status="APROVADO" />
      <span className={rotulo}>Validação concluída</span>
    </div>
  </div>
);

const contagens = [
  { status: 'RASCUNHO' as const, count: 38 },
  { status: 'ENVIADO' as const, count: 21 },
  { status: 'APROVADO' as const, count: 64 },
];

export const ContagemPorStatus = () => (
  <div className="grid grid-cols-3 gap-2" style={{ width: '30rem' }}>
    {contagens.map(({ status, count }) => (
      <div
        key={status}
        className="flex items-center justify-between gap-2 border border-black/20 bg-card p-2.5"
      >
        <StatusBadge status={status} />
        <span className="text-lg font-semibold tabular-nums">{count}</span>
      </div>
    ))}
  </div>
);

export const NaListaDeValidacoes = () => (
  <ul className="flex flex-col gap-2" style={{ width: '22rem' }}>
    <li className="flex flex-col gap-2 border border-black/20 bg-card px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status="ENVIADO" />
        <ThemeBadge theme="OCAD" />
      </div>
      <p className="text-sm font-semibold leading-5 text-foreground">
        RECOMPOSIÇÃO DAS APRENDIZAGENS.
      </p>
      <div className="flex min-w-0 items-baseline gap-2 border-t border-black/20 pt-2">
        <span className="shrink-0 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          001
        </span>
        <span className="truncate text-[11px] text-muted-foreground">UNIDADE GESTORA</span>
      </div>
    </li>
    <li className="flex flex-col gap-2 border border-black/20 bg-card px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status="DEVOLVIDO" />
        <ThemeBadge theme="OSG" />
      </div>
      <p className="text-sm font-semibold leading-5 text-foreground">
        FORTALECIMENTO DAS AÇÕES DE ENFRENTAMENTO À VIOLÊNCIA CONTRA A MULHER NO ÂMBITO DA PMAC.
      </p>
      <div className="flex min-w-0 items-baseline gap-2 border-t border-black/20 pt-2">
        <span className="shrink-0 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          001
        </span>
        <span className="truncate text-[11px] text-muted-foreground">UNIDADE GESTORA</span>
      </div>
    </li>
  </ul>
);
