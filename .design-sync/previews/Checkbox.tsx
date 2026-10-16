import { Badge, Checkbox, Label } from 'orcamentos-tematicos';

export const ComRotulo = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Checkbox id="cb-emendas" defaultChecked />
      <Label htmlFor="cb-emendas">Incluir emendas parlamentares</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-pendentes" />
      <Label htmlFor="cb-pendentes">Somente ações com entregas pendentes</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-comparativo" disabled />
      <Label htmlFor="cb-comparativo">Incluir exercício comparativo (2025)</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-corrente" disabled defaultChecked />
      <Label htmlFor="cb-corrente">Exercício corrente (2026)</Label>
    </div>
  </div>
);

export const Estados = () => (
  <div className="flex flex-wrap items-start gap-6">
    {(
      [
        { id: 'st-vazio', label: 'Desmarcado', props: {} },
        { id: 'st-marcado', label: 'Marcado', props: { checked: true } },
        { id: 'st-parcial', label: 'Parcial', props: { checked: 'indeterminate' as const } },
        { id: 'st-desab', label: 'Desabilitado', props: { disabled: true } },
        { id: 'st-invalido', label: 'Inválido', props: { 'aria-invalid': true } },
      ] as const
    ).map((item) => (
      <div key={item.id} className="flex flex-col items-center gap-2">
        <Checkbox id={item.id} aria-label={item.label} {...item.props} />
        <span className="text-xs text-muted-foreground">{item.label}</span>
      </div>
    ))}
  </div>
);

const municipios = [
  { name: 'Acrelândia', checked: true },
  { name: 'Assis Brasil', checked: false },
  { name: 'Brasiléia', checked: true },
  { name: 'Bujari', checked: false },
  { name: 'Capixaba', checked: false },
  { name: 'Cruzeiro do Sul', checked: true },
];

export const ListaDeMunicipios = () => (
  <ul className="flex flex-col rounded-lg border p-1" style={{ width: '18rem' }}>
    {municipios.map((m) => {
      const id = `mun-${m.name}`;
      return (
        <li key={m.name} className="flex items-center gap-2 rounded-md px-2.5 py-2">
          <Checkbox id={id} defaultChecked={m.checked} />
          <Label htmlFor={id} className="font-normal">
            {m.name}
          </Label>
        </li>
      );
    })}
  </ul>
);

const ocorrencias = [
  { org: '762 — Secretaria de Estado da Mulher', unit: 'Fundo Estadual de Políticas para as Mulheres', relocated: true },
  { org: '721 — Secretaria de Estado de Saúde', unit: 'Fundo Estadual de Políticas para as Mulheres', relocated: false },
];

export const SelecaoDeUnidades = () => (
  <div className="rounded-lg border" style={{ width: '100%', maxWidth: '26rem' }}>
    <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
        762301
      </span>
      <span className="text-xs text-muted-foreground">2 ocorrências</span>
    </div>
    <div className="flex flex-col divide-y">
      {ocorrencias.map((occ) => (
        <div
          key={occ.org}
          className={`flex items-center gap-3 px-3 py-2.5 ${occ.relocated ? 'bg-primary/5' : ''}`}
        >
          <Checkbox className="pointer-events-none size-5" checked={occ.relocated} tabIndex={-1} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-snug">{occ.unit}</p>
            <p className="truncate text-xs text-muted-foreground">{occ.org}</p>
          </div>
          {occ.relocated ? (
            <Badge variant="secondary" className="shrink-0">
              Realocada
            </Badge>
          ) : null}
        </div>
      ))}
    </div>
  </div>
);
