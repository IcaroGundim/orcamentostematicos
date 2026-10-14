import type { ExecutionMetric } from '@/lib/execution-monitor';

/**
 * Cores de dado dos gráficos de `/orcamento`, separadas da marca: o verde do governo
 * fica no cromo (cabeçalho, faixas, títulos de painel), e os gráficos usam esta
 * paleta. Decisão do dono do produto em 2026-10-14 (contrato, seção 4).
 *
 * Os tons e a ordem vêm de uma paleta de referência validada para daltonismo
 * (protanopia/deuteranopia, ΔE ≥ 9 entre vizinhos). Trocar uma cor aqui troca em todo
 * o módulo; rode de novo a validação antes de trocar.
 */

/** Oito tons em ordem fixa, para séries e listas com até oito itens. Nunca ciclar. */
export const CHART_CATEGORICAL = [
  '#2a78d6', // azul
  '#eb6834', // laranja
  '#1baf7a', // verde-água
  '#eda100', // amarelo
  '#e87ba4', // rosa
  '#008300', // verde
  '#6250d6', // violeta
  '#e34948', // vermelho
] as const;

/** Cor do item `index` de uma lista; além do oitavo, cai no tom de "demais". */
export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL[index] ?? CHART_OTHER;
}

/** Fatia ou barra que consolida o restante ("Demais órgãos"). */
export const CHART_OTHER = '#898781';

/**
 * Uma cor por estágio do ciclo da despesa, a mesma em todo o módulo (barras
 * empilhadas, estágios e índices da visão Órgão, cartões de uma série). Os quatro
 * passam juntos na validação de vizinhos e têm contraste ≥ 3:1 sobre o branco.
 */
export const STAGE_COLORS = {
  /** Dotação (inicial ou atualizada) e o que dela ainda não foi empenhado. */
  budget: '#6250d6',
  committed: '#eb6834',
  liquidated: '#2a78d6',
  paid: '#008300',
} as const;

/** Cor do estágio exibido por um cartão de uma série. */
export function metricColor(metric: ExecutionMetric): string {
  switch (metric) {
    case 'committed':
      return STAGE_COLORS.committed;
    case 'liquidated':
      return STAGE_COLORS.liquidated;
    case 'paid':
      return STAGE_COLORS.paid;
    default:
      return STAGE_COLORS.budget;
  }
}

/** Par divergente das alterações da dotação: acréscimo e redução. */
export const CHANGE_COLORS = {
  increase: '#2a78d6',
  reduction: '#e34948',
} as const;

/**
 * Rampa sequencial de uma cor só (azul, do claro ao escuro) para "% executado" no mapa
 * de áreas: a área diz o tamanho, a cor diz quanto já foi liquidado. Cinco faixas de
 * 10 pontos; a última abre ("40% ou mais") porque, no meio do exercício, quase nada
 * passa disso e uma rampa até 100% deixaria tudo no mesmo tom claro.
 */
export const SEQUENTIAL_EXECUTION = [
  { color: '#cde2fb', label: 'até 10%' },
  { color: '#9ec5f4', label: '10–20%' },
  { color: '#5598e7', label: '20–30%' },
  { color: '#256abf', label: '30–40%' },
  { color: '#104281', label: '40% ou mais' },
] as const;

/** Faixa da rampa para um percentual de execução (0–100). */
export function sequentialExecutionColor(rate: number): string {
  const index = Math.min(SEQUENTIAL_EXECUTION.length - 1, Math.max(0, Math.floor(rate / 10)));
  return SEQUENTIAL_EXECUTION[index]!.color;
}

/** Texto legível sobre a faixa: escuro nas duas mais claras, branco nas demais. */
export function sequentialExecutionInk(rate: number): string {
  return rate >= 20 ? '#ffffff' : '#141714';
}

/** Tom do sinal nos rótulos de saldo: o par de `CHANGE_COLORS`, escurecido para texto. */
export const CHANGE_TEXT_COLORS = {
  increase: '#1d5aa6',
  reduction: '#b3302f',
} as const;
