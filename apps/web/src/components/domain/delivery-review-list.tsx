import { formatMoney } from '@/lib/api';
import { sumDeliveryExecutedValues, usesDeliveryValues } from '@/lib/classification-rules';
import type { DeliveryReport, ThemeBudget } from '@/types/domain';
import { DeliveryReviewCard } from '@/components/domain/delivery-review-card';

export type DeliveryReviewListProps = {
  deliveries: DeliveryReport[];
  informedExecutedValue?: number;
  theme?: ThemeBudget | string;
  classification?: string;
};

export function DeliveryReviewList({
  deliveries,
  informedExecutedValue,
  theme,
  classification,
}: DeliveryReviewListProps) {
  if (deliveries.length === 0) {
    return null;
  }

  const perDelivery =
    Boolean(theme && classification) && usesDeliveryValues(theme!, classification!);
  const deliverySum = sumDeliveryExecutedValues(deliveries);
  const headerTotal = perDelivery
    ? deliverySum > 0
      ? deliverySum
      : informedExecutedValue
    : informedExecutedValue;
  const showValueOnCards = perDelivery || deliveries.length === 1;
  const countLabel = `${deliveries.length} entrega${deliveries.length !== 1 ? 's' : ''}`;
  const totalLabel =
    headerTotal != null && headerTotal > 0 ? formatMoney(headerTotal) : null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">Entregas realizadas</h4>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <p>{countLabel}</p>
          {perDelivery && deliveries.length > 1 && totalLabel ? (
            <p className="font-medium text-foreground">Total: {totalLabel}</p>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {deliveries.map((delivery, index) => (
          <DeliveryReviewCard
            key={delivery.id ?? index}
            delivery={delivery}
            index={index}
            executedValue={
              showValueOnCards && !perDelivery ? informedExecutedValue : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
