import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldDescription,
  FieldLabel,
  Textarea,
} from 'orcamentos-tematicos';
import { EyeIcon, RotateCcwIcon } from 'lucide-react';

// Célula exibida no cartão (cardMode single): o diálogo aberto.
export const Aberto = () => (
  <Dialog defaultOpen>
    <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Devolver validação à secretaria</DialogTitle>
        <DialogDescription>
          2231 · Atenção Especializada em Saúde da Mulher — 721 - Secretaria de Estado de Saúde
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="dlg-comentario">Comentário para a secretaria</FieldLabel>
        <Textarea
          id="dlg-comentario"
          rows={3}
          defaultValue="Informe os municípios atendidos na entrega 2 e detalhe o público beneficiado antes de reenviar."
        />
        <FieldDescription>O comentário aparece no topo do formulário de validação da secretaria.</FieldDescription>
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button>
          <RotateCcwIcon data-icon="inline-start" />
          Devolver para ajuste
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const detalhes = [
  ['Quantidade', '1.250'],
  ['Municípios', 'Rio Branco, Cruzeiro do Sul, Tarauacá'],
  ['Público beneficiado', 'Mulheres em situação de violência doméstica'],
  ['Valor executado', 'R$ 412.380,00'],
] as const;

export const SemBotaoFechar = () => (
  <Dialog defaultOpen>
    <DialogContent showCloseButton={false} onOpenAutoFocus={(event) => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Atendimentos na Casa da Mulher Brasileira</DialogTitle>
        <DialogDescription>Entrega 1 · Validação enviada em 15/09/2026</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {detalhes.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Fechar</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const Fechado = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">
        <EyeIcon data-icon="inline-start" />
        Ver detalhes da entrega
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Atendimentos na Casa da Mulher Brasileira</DialogTitle>
        <DialogDescription>Entrega 1 · Validação enviada em 15/09/2026</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);
