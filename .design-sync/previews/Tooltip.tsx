import { Button, Tooltip, TooltipContent, TooltipTrigger } from 'orcamentos-tematicos';
import { InfoIcon, RefreshCwIcon } from 'lucide-react';

export const Aberto = () => (
  <div className="flex items-center justify-center bg-white" style={{ width: '32rem', height: '12rem' }}>
    <div className="min-w-0 border border-black/70 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>Orçamento comprometido (%)</span>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 text-marca-escura hover:text-marca-escura"
              aria-label="Como é calculado: Orçamento comprometido (%)"
            >
              <InfoIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            Valor empenhado dividido pela dotação atualizada, considerando a Fonte 100.
          </TooltipContent>
        </Tooltip>
      </dt>
      <dd className="mt-1 text-base font-bold tabular-nums">82,5%</dd>
    </div>
  </div>
);

export const NoBotao = () => (
  <div className="flex items-center justify-center bg-white" style={{ width: '24rem', height: '9rem' }}>
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Atualizar dados">
          <RefreshCwIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Atualizar dados</TooltipContent>
    </Tooltip>
  </div>
);

export const Explicativo = () => (
  <div className="flex items-start bg-white p-4" style={{ width: '36rem', height: '14rem' }}>
    <span className="flex items-center gap-1.5 text-sm font-medium">
      Classificação
      <Tooltip open>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="O que é gasto exclusivo ou não exclusivo?"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-xs border border-border bg-white text-sm leading-snug text-black [&>svg]:bg-white [&>svg]:fill-white"
        >
          <div className="flex flex-col gap-2">
            <p>
              <strong>Gastos Exclusivos:</strong> São gastos que beneficiam exclusivamente mulheres sem impacto em
              outros grupos sociais.
            </p>
            <p>
              <strong>Gastos Não Exclusivos:</strong> Incluem gastos que beneficiam tanto mulheres quanto outros grupos
              sociais.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </span>
  </div>
);
