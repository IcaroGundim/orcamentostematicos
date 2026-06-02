import type { ThemeBudget } from '@/types/domain';

/** OCAD Exclusivo, OSG Categoria 1 e Climático Exclusiva exigem 100% do valor do programa (ponderador = 1). */
export function isExclusiveAllocation(theme: ThemeBudget | string, classification: string): boolean {
  if (theme === 'OCAD') return classification === 'EXCLUSIVO';
  if (theme === 'OSG') return classification === 'CATEGORIA_1';
  if (theme === 'CLIMATICO') return classification === 'EXCLUSIVA';
  return false;
}

export function usesDeliveryValues(theme: ThemeBudget | string, classification: string): boolean {
  return (
    (theme === 'OSG' && classification === 'CATEGORIA_2') ||
    (theme === 'CLIMATICO' && classification === 'INDIRETA')
  );
}

export function isWeightingFactorLocked(theme: ThemeBudget | string, classification: string): boolean {
  return isExclusiveAllocation(theme, classification) || (theme === 'OSG' && classification === 'CATEGORIA_3');
}

export function shouldHideWeightingFactor(theme: ThemeBudget | string, classification: string): boolean {
  return usesDeliveryValues(theme, classification);
}

export function resolveWeightingFactor(
  theme: ThemeBudget | string,
  classification: string,
  input?: number | null,
): number | null {
  if (isExclusiveAllocation(theme, classification)) return 1;
  if (theme === 'OSG' && classification === 'CATEGORIA_2') return null;
  if (theme === 'OSG' && classification === 'CATEGORIA_3') return 0.5;
  if (input == null || Number.isNaN(input)) return null;
  return input;
}

export function lockedWeightingFactorLabel(theme: ThemeBudget | string, classification: string): string | null {
  if (isExclusiveAllocation(theme, classification)) {
    if (theme === 'OSG') {
      return 'Categoria 1 (exclusiva): 100% do valor do programa (ponderador fixo em 1).';
    }
    return 'Dotação exclusiva: 100% do valor do programa (ponderador fixo em 1).';
  }
  if (theme === 'OSG' && classification === 'CATEGORIA_3') {
    return 'Categoria 3: 50% referente à demografia do Acre (ponderador fixo em 0,5).';
  }
  if (usesDeliveryValues(theme, classification)) {
    if (theme === 'CLIMATICO') {
      return 'Não Exclusivo: o ponderador não se aplica. Na validação, informe o valor executado em cada entrega dentro do programa/ação; o total será calculado automaticamente.';
    }
    return 'Categoria 2: o ponderador não se aplica. Na validação, informe o valor executado em cada entrega; o total será calculado automaticamente.';
  }
  return null;
}

/** Valor exibido no formulário de curadoria (string para input controlado). */
export function weightingFactorFormValue(
  theme: ThemeBudget | string,
  classification: string,
  stored?: string | number | null,
): string {
  if (shouldHideWeightingFactor(theme, classification)) return '';
  const resolved = resolveWeightingFactor(
    theme,
    classification,
    stored === '' || stored == null ? null : Number(stored),
  );
  if (resolved === 1) return '1';
  if (resolved === 0.5) return '0.5';
  if (resolved == null) return stored != null && stored !== '' ? String(stored) : '';
  return String(resolved);
}

export function sumDeliveryExecutedValues(
  deliveries: Array<{ executedValue?: number | null | unknown }>,
): number {
  return deliveries.reduce((sum, delivery) => sum + (Number(delivery.executedValue) || 0), 0);
}

export function resolveInformedExecutedValue(params: {
  theme: ThemeBudget | string;
  classification: string;
  deliveries: Array<{ executedValue?: number | null | unknown }>;
  informedExecutedValue?: number | null;
}): number {
  if (usesDeliveryValues(params.theme, params.classification)) {
    return sumDeliveryExecutedValues(params.deliveries);
  }
  const value = Number(params.informedExecutedValue);
  return Number.isFinite(value) ? value : 0;
}
