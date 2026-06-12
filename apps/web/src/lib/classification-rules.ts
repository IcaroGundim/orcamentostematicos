import type { ThemeBudget } from '@/types/domain';

/**
 * Status em que as entregas de uma categoria por entrega são consideradas
 * verificadas — a partir daí o valor executado conta no planejado/liquidado.
 */
export const DELIVERY_VERIFIED_STATUS = 'APROVADO';

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

/** OCAD Não Exclusivo: ponderador fixo em 36% da dotação da ação (não editável). */
export function isOcadNaoExclusivo(theme: ThemeBudget | string, classification: string): boolean {
  return theme === 'OCAD' && classification === 'NAO_EXCLUSIVO';
}

export function isWeightingFactorLocked(theme: ThemeBudget | string, classification: string): boolean {
  return (
    isExclusiveAllocation(theme, classification) ||
    (theme === 'OSG' && classification === 'CATEGORIA_3') ||
    isOcadNaoExclusivo(theme, classification)
  );
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
  if (isOcadNaoExclusivo(theme, classification)) return 0.36;
  if (input == null || Number.isNaN(input)) return null;
  return input;
}

/**
 * Fração da dotação da ação efetivamente atribuída ao tema (ponderador aplicado nas
 * visões baseadas em orçamento). Ex.: OCAD Não Exclusivo → 0,36; exclusivos → 1.
 *
 * Categorias baseadas em entregas (OSG Categoria 2, Climático Não Exclusivo) retornam
 * 0: nessas, o acompanhamento é pelo valor executado nas entregas (informado na
 * validação pelas setoriais), e não por um percentual do orçamento — logo, no
 * planejado/liquidado orçamentário elas só passam a contar após a validação.
 */
export function effectiveWeightingFactor(
  theme: ThemeBudget | string,
  classification: string,
  stored?: number | null,
): number {
  if (usesDeliveryValues(theme, classification)) return 0;
  return resolveWeightingFactor(theme, classification, stored ?? null) ?? 1;
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
  if (isOcadNaoExclusivo(theme, classification)) {
    return 'Não exclusivo: 36% da dotação da ação (ponderador fixo em 0,36).';
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

/**
 * Mapeia assignmentId → valor executado nas entregas, considerando apenas validações
 * já verificadas (status {@link DELIVERY_VERIFIED_STATUS}) de categorias por entrega.
 * Usado para incorporar o executado dessas categorias às visões orçamentárias.
 */
export function buildVerifiedDeliveryExecutedMap(
  validations: Array<{
    assignmentId: string;
    theme: ThemeBudget | string;
    status: string;
    deliveries?: Array<{ executedValue?: number | null | unknown }> | null;
    assignment?: { classification?: string | null } | null;
    classification?: string | null;
  }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of validations) {
    if (v.status !== DELIVERY_VERIFIED_STATUS) continue;
    const classification = v.assignment?.classification ?? v.classification ?? '';
    if (!usesDeliveryValues(v.theme, classification)) continue;
    map.set(v.assignmentId, sumDeliveryExecutedValues(v.deliveries ?? []));
  }
  return map;
}

/**
 * Contribuição de uma classificação às visões orçamentárias (planejado e liquidado),
 * já aplicando o ponderador.
 *
 * - Categorias por percentual (exclusivos, OCAD Não Exclusivo 36%, OSG Cat. 3 50%, etc.):
 *   planejado = dotação atualizada × ponderador; liquidado = liquidado da ação × ponderador.
 * - Categorias por entrega (OSG Cat. 2, Climático Não Exclusivo): enquanto não validadas,
 *   contribuem com 0; após a validação das entregas, o valor executado nas entregas conta
 *   tanto para o planejado quanto para o liquidado.
 */
export function thematicBudgetContribution(params: {
  theme: ThemeBudget | string;
  classification: string;
  weightingFactor?: number | null;
  updatedBudget: number;
  liquidated: number;
  /** Valor executado validado nas entregas; usado apenas nas categorias por entrega. */
  deliveryExecutedValue?: number | null;
}): { planned: number; liquidated: number } {
  if (usesDeliveryValues(params.theme, params.classification)) {
    const executed = Number(params.deliveryExecutedValue) || 0;
    return { planned: executed, liquidated: executed };
  }
  const factor = effectiveWeightingFactor(params.theme, params.classification, params.weightingFactor);
  return {
    planned: params.updatedBudget * factor,
    liquidated: params.liquidated * factor,
  };
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
