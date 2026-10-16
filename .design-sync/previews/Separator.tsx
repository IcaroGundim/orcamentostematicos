import { Button, Separator } from 'orcamentos-tematicos';
import { CheckIcon, Trash2Icon, XIcon } from 'lucide-react';

export const Horizontal = () => (
  <div className="flex w-[34rem] flex-col bg-white p-4">
    <div className="grid grid-cols-3 gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Enviadas
        </span>
        <span className="text-2xl font-semibold tabular-nums">38</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Aprovadas
        </span>
        <span className="text-2xl font-semibold tabular-nums">112</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Devolvidas
        </span>
        <span className="text-2xl font-semibold tabular-nums">9</span>
      </div>
    </div>
    <Separator className="my-3" />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>Página 1 de 8</span>
      <span className="tabular-nums">159 validações no ciclo do 2º quadrimestre</span>
    </div>
  </div>
);

export const Vertical = () => (
  <div className="flex w-fit items-center gap-2 bg-white p-2">
    <span className="text-sm text-muted-foreground tabular-nums">3 ações selecionadas</span>
    <Button type="button" size="sm" variant="ghost">
      <XIcon data-icon="inline-start" />
      Limpar seleção
    </Button>
    <Separator orientation="vertical" className="h-7" />
    <Button type="button" size="sm" variant="outline">
      <CheckIcon data-icon="inline-start" />
      Aplicar classificação
    </Button>
    <Button type="button" size="sm" variant="outline">
      <Trash2Icon data-icon="inline-start" />
      Remover marcação
    </Button>
  </div>
);

export const EmTexto = () => (
  <div className="flex h-5 w-fit items-center gap-3 bg-white text-sm">
    <span className="font-medium tabular-nums">Exercício 2026</span>
    <Separator orientation="vertical" />
    <span className="text-muted-foreground">Acumulado até agosto</span>
    <Separator orientation="vertical" />
    <span className="text-muted-foreground tabular-nums">1.284 ações · 6.917 linhas</span>
  </div>
);
