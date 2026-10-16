import { formatMoney } from '@/lib/api';

/**
 * Formatos numéricos da execução orçamentária que não cabem em `formatMoney`
 * (por extenso, em `src/lib/api.ts`): o compacto dos gráficos, o percentual e o
 * valor com sinal. Ficam aqui para não serem reescritos em cada componente
 * (contrato, seção 10.7).
 */

/** Meio centavo: abaixo disso, um saldo é zero (soma de ponto flutuante). */
const CENT_TOLERANCE = 0.005;

function trimZero(value: number): number {
  return Math.abs(value) < CENT_TOLERANCE ? 0 : value;
}

/** "R$ 1,2 bi", "R$ 460,1 mi", "R$ 830 mil"; abaixo de mil, por extenso. */
export function compactMoney(value: number): string {
  const v = trimZero(value);
  if (v < 0) return `−${compactMoney(-v)}`;
  if (v >= 1_000_000_000) {
    return `R$ ${(v / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  }
  if (v >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (v >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  }
  return formatMoney(v);
}

/** Valor de eixo, sem o "R$ " (o título do gráfico já diz a unidade). */
export function compactAxis(value: number): string {
  return trimZero(value) === 0 ? '0' : compactMoney(value).replace('R$ ', '');
}

/** "12,3%", sempre com uma casa. */
export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/**
 * Valor com sinal tipográfico: "+R$ 1,00", "−R$ 1,00" e, para o que arredonda a
 * zero, "R$ 0,00" — nunca "-R$ 0,00" (contrato, seção 6.7).
 */
export function signedMoney(value: number): string {
  const v = trimZero(value);
  if (v < 0) return `−${formatMoney(-v)}`;
  return `${v > 0 ? '+' : ''}${formatMoney(v)}`;
}

/** Como `signedMoney`, no formato compacto. */
export function signedCompactMoney(value: number): string {
  const v = trimZero(value);
  return `${v > 0 ? '+' : ''}${compactMoney(v)}`;
}
