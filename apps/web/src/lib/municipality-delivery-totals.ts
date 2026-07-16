import {
  ACRE_MUNICIPALITY_OPTIONS,
  parseMunicipalitySelection,
  type AcreMunicipalityOption,
} from '@/lib/acre-municipalities';
import type { ValidationItem } from '@/types/domain';

export type AcreMunicipalityName = Exclude<AcreMunicipalityOption, 'Fora do estado'>;

export type MunicipalityDeliveryTotal = {
  municipality: AcreMunicipalityName;
  deliveries: number;
};

export type MunicipalityDeliverySummary = {
  totals: MunicipalityDeliveryTotal[];
  outsideStateDeliveries: number;
};

const ACRE_MUNICIPALITIES = ACRE_MUNICIPALITY_OPTIONS.filter(
  (municipality): municipality is AcreMunicipalityName => municipality !== 'Fora do estado',
);

type ValidationWithDeliveries = Pick<ValidationItem, 'deliveries' | 'status' | 'theme'>;

export function aggregateApprovedDeliveriesByMunicipality(
  validations: ValidationWithDeliveries[],
  theme?: ValidationItem['theme'],
): MunicipalityDeliverySummary {
  const totals = new Map<AcreMunicipalityName, number>(
    ACRE_MUNICIPALITIES.map((municipality) => [municipality, 0]),
  );
  let outsideStateDeliveries = 0;

  for (const validation of validations) {
    if (validation.status !== 'APROVADO') continue;
    if (theme && validation.theme !== theme) continue;

    for (const delivery of validation.deliveries ?? []) {
      // Cada entrega conta como 1 em cada município onde ocorreu — a quantidade
      // informada na entrega não é somada.
      const municipalities = new Set(parseMunicipalitySelection(delivery.municipality));

      for (const municipality of municipalities) {
        if (municipality === 'Fora do estado') {
          outsideStateDeliveries += 1;
          continue;
        }
        totals.set(municipality, (totals.get(municipality) ?? 0) + 1);
      }
    }
  }

  return {
    totals: ACRE_MUNICIPALITIES.map((municipality) => ({
      municipality,
      deliveries: totals.get(municipality) ?? 0,
    })),
    outsideStateDeliveries,
  };
}
