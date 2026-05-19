import type { DeliveryReport } from '@/types/domain';
import { DeliveryReviewCard } from '@/components/domain/delivery-review-card';

export type DeliveryReviewListProps = {
  deliveries: DeliveryReport[];
  /** Total informed executed value for the validation (not per delivery in the domain model). */
  informedExecutedValue?: number;
};

export function DeliveryReviewList({ deliveries, informedExecutedValue }: DeliveryReviewListProps) {
  if (deliveries.length === 0) {
    return null;
  }

  const countLabel = `${deliveries.length} entrega${deliveries.length !== 1 ? 's' : ''}`;
  const showValueOnCards = deliveries.length === 1;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/15 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">Entregas realizadas</h4>
        <p className="text-xs text-muted-foreground">{countLabel}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {deliveries.map((delivery, index) => (
          <DeliveryReviewCard
            key={delivery.id ?? index}
            delivery={delivery}
            index={index}
            executedValue={showValueOnCards ? informedExecutedValue : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
