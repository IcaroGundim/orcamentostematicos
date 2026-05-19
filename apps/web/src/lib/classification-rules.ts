import type { ThemeBudget } from '@/types/domain';

/** OCAD Exclusivo e OSG Categoria 1 exigem 100% do valor do programa (ponderador = 1). */
export function isExclusiveAllocation(theme: ThemeBudget | string, classification: string): boolean {
  if (theme === 'OCAD') return classification === 'EXCLUSIVO';
  if (theme === 'OSG') return classification === 'CATEGORIA_1';
  return false;
}

export function resolveWeightingFactor(
  theme: ThemeBudget | string,
  classification: string,
  input?: number | null,
): number | null {
  if (isExclusiveAllocation(theme, classification)) return 1;
  if (input == null || Number.isNaN(input)) return null;
  return input;
}
