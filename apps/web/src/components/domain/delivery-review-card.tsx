import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/api';
import type { DeliveryReport } from '@/types/domain';

export type DeliveryReviewCardProps = {
  delivery: DeliveryReport;
  index: number;
  /** Fallback when delivery has no per-delivery value (e.g. single delivery, Cat. 1/3). */
  executedValue?: number;
};

function MetaItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-medium leading-snug text-foreground">{children}</p>
    </div>
  );
}

function formatExecutedValue(value: number | undefined) {
  if (value == null || value <= 0) return null;
  return formatMoney(value);
}

export function DeliveryReviewCard({ delivery, index, executedValue }: DeliveryReviewCardProps) {
  const label = delivery.name?.trim() || `Entrega ${index + 1}`;
  const hasDescription = Boolean(delivery.description?.trim());
  const displayValue = delivery.executedValue ?? executedValue;
  const valueLabel = formatExecutedValue(displayValue);

  return (
    <li className="rounded-md border border-border/80 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-base font-semibold leading-snug text-foreground">
        {hasDescription ? delivery.description : 'Sem descrição informada.'}
      </p>
      <div className="mt-3 grid gap-3 border-t border-border/50 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem label="Quantidade">{delivery.quantity}</MetaItem>
        <MetaItem label="Município">{delivery.municipality}</MetaItem>
        {valueLabel ? <MetaItem label="Valor executado">{valueLabel}</MetaItem> : null}
        <MetaItem label="Público beneficiado" className="sm:col-span-2 lg:col-span-3">
          {delivery.beneficiaries}
        </MetaItem>
      </div>
    </li>
  );
}
