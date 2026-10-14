import {
  Badge,
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
  ThemeBadge,
} from 'orcamentos-tematicos';

export const Temas = () => (
  <div className="flex flex-wrap items-center gap-2">
    <ThemeBadge theme="OCAD" />
    <ThemeBadge theme="OSG" />
    <ThemeBadge theme="CLIMATICO" />
  </div>
);

export const MarcacoesDaAcao = () => (
  <div className="flex flex-col gap-3" style={{ width: '32rem' }}>
    <div className="flex items-start justify-between gap-3 border-b border-black/20 pb-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">
          PROMOÇÃO DO MEIO AMBIENTE E CIDADES SUSTENTÁVEIS E RESILIENTES.
        </p>
        <p className="text-[11px] text-muted-foreground">720 · UNIDADE GESTORA</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <ThemeBadge theme="OSG" />
        <ThemeBadge theme="CLIMATICO" />
      </div>
    </div>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">MANUTENÇÃO DO TRANSPORTE ESCOLAR.</p>
        <p className="text-[11px] text-muted-foreground">717 · UNIDADE GESTORA</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Badge variant="secondary">Sem tema</Badge>
      </div>
    </div>
  </div>
);

export const NoCabecalhoDaValidacao = () => (
  <Card style={{ width: '40rem' }}>
    <CardHeader className="bg-card text-card-foreground [&_[data-slot=card-title]]:text-card-foreground [&_[data-slot=card-description]]:text-muted-foreground">
      <CardTitle>PROMOÇÃO DO MEIO AMBIENTE E CIDADES SUSTENTÁVEIS E RESILIENTES.</CardTitle>
      <CardDescription>11200000 | SECRETARIA DE ESTADO DO MEIO AMBIENTE - SEMA</CardDescription>
      <CardAction className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-medium">
          Exclusiva
        </Badge>
        <ThemeBadge theme="CLIMATICO" />
        <StatusBadge status="RASCUNHO" />
      </CardAction>
    </CardHeader>
  </Card>
);
