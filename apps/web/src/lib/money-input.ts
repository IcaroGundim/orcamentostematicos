import { formatMoney } from '@/lib/api';

/** Converte texto digitado (com ou sem máscara) em valor decimal em reais. */
export function parseMoneyInput(input: string): number | undefined {
  const digits = input.replace(/\D/g, '');
  if (!digits) return undefined;
  return Number(digits) / 100;
}

/** Formata número para exibição em campo de entrada (pt-BR, BRL). */
export function formatMoneyInput(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return formatMoney(value);
}
