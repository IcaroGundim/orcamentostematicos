import { Badge } from 'orcamentos-tematicos';
import { CheckCircle2Icon, ClockIcon, FileSpreadsheetIcon, UserXIcon } from 'lucide-react';

export const Variantes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Vigente</Badge>
    <Badge variant="secondary">Apenas comparativo</Badge>
    <Badge variant="destructive">Inativo</Badge>
    <Badge variant="outline">Exercício 2026</Badge>
    <Badge variant="ghost">Rascunho</Badge>
    <Badge variant="link">Ver histórico</Badge>
  </div>
);

export const ComIcone = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>
      <CheckCircle2Icon data-icon="inline-start" />
      Corrente
    </Badge>
    <Badge variant="secondary">
      <ClockIcon data-icon="inline-start" />
      Aguardando revisão
    </Badge>
    <Badge variant="outline">
      <FileSpreadsheetIcon data-icon="inline-start" />
      SICAF
    </Badge>
    <Badge variant="destructive">
      <UserXIcon data-icon="inline-start" />
      Inativo
    </Badge>
  </div>
);

export const LinhaDeUsuario = () => (
  <div className="flex w-[34rem] flex-col gap-1 border-b border-black/20 px-3 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">Representante da SEE</span>
      <Badge variant="outline">Representante</Badge>
      <Badge className="bg-marca text-marca-contraste hover:bg-marca-hover">Sessão ativa</Badge>
    </div>
    <p className="text-xs text-muted-foreground">representante.see@exemplo.gov.br</p>
    <p className="text-xs text-muted-foreground">Unidade 001 · Último acesso há 12 minutos</p>
    <div className="mt-1 flex flex-wrap gap-1.5">
      <Badge variant="secondary">Em curadoria: 4</Badge>
      <Badge variant="secondary">Rascunhos/devolvidos: 2</Badge>
      <Badge variant="secondary">Aguardando revisão: 7</Badge>
    </div>
  </div>
);

export const HistoricoDeBases = () => (
  <div className="flex w-[34rem] flex-col gap-2">
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="shrink-0">Base única</Badge>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          Exercício 2026
        </Badge>
        <span className="font-medium">Jan–08/2026</span>
        <span className="text-xs text-muted-foreground">Acumulado</span>
      </div>
      <span className="truncate text-xs text-muted-foreground">QDD_Saldo_Retroativo_2026-09-18.xlsx</span>
    </div>
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="shrink-0">Base única</Badge>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          Exercício 2025
        </Badge>
        <Badge variant="secondary">Apenas comparativo</Badge>
        <span className="font-medium">Jan–12/2025</span>
      </div>
      <span className="truncate text-xs text-muted-foreground">QDD_Fechamento_2025.xlsx</span>
    </div>
  </div>
);
