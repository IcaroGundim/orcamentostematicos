/**
 * Agregações do monitoramento da execução orçamentária (`/orcamento`).
 *
 * Funções puras sobre as ações do QDD vigente, sem I/O — a rota carrega as ações
 * uma vez por `GET /api/budget-actions` e agrega aqui.
 *
 * **Nível de cada eixo:** elemento de despesa e fonte de recurso só existem em
 * `ExpenseLine`, então essas agregações percorrem `action.expenseLines`. Já ação
 * orçamentária e emenda são atributos da ação e usam `action.totals`.
 */

import { cleanExpenseDescription } from './expense-breakdown';
import { EXPENSE_GROUPS, expenseElementName, parseExpenseAccount } from './expense-nature';
import { actionIsAmendment } from './functional-classification';
import { getFonteLabel } from './fontes-recursos';
import type { BudgetAction, ExpenseLine } from '@/types/domain';

export interface ExecutionTotals {
  initialBudget: number;
  updatedBudget: number;
  committed: number;
  liquidated: number;
  paid: number;
  available: number;
}

export interface ExecutionRow extends ExecutionTotals {
  /** Chave estável do agrupamento (código do elemento, id da ação, fonte…). */
  key: string;
  /** Rótulo já formatado para exibição. */
  label: string;
  /** Rótulo curto, para eixos de gráfico. */
  shortLabel: string;
  /** Quantas linhas/ações compõem a linha agregada. */
  count: number;
  /** Liquidado ÷ dotação atualizada, em %. */
  executionRate: number;
}

const EMPTY: ExecutionTotals = {
  initialBudget: 0,
  updatedBudget: 0,
  committed: 0,
  liquidated: 0,
  paid: 0,
  available: 0,
};

/**
 * Percentual de execução: liquidado sobre a **dotação atualizada**.
 *
 * Atenção: é uma base diferente da usada nos orçamentos temáticos, que medem
 * sobre a dotação **inicial** (ver `thematicBudgetContribution` em
 * `classification-rules.ts`). Aqui o acompanhamento é da execução real, então o
 * denominador correto é o orçamento vigente, já com suplementações.
 */
export function executionRate(liquidated: number, updatedBudget: number): number {
  if (!updatedBudget) return 0;
  return (liquidated / updatedBudget) * 100;
}

function addTotals(target: ExecutionTotals, source: Partial<ExecutionTotals>): void {
  target.initialBudget += source.initialBudget ?? 0;
  target.updatedBudget += source.updatedBudget ?? 0;
  target.committed += source.committed ?? 0;
  target.liquidated += source.liquidated ?? 0;
  target.paid += source.paid ?? 0;
  target.available += source.available ?? 0;
}

type Bucket = ExecutionTotals & { key: string; label: string; shortLabel: string; count: number };

function bucketOf(map: Map<string, Bucket>, key: string, label: string, shortLabel: string): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { key, label, shortLabel, count: 0, ...EMPTY };
    map.set(key, bucket);
  }
  return bucket;
}

/** Ordena do maior liquidado para o menor e calcula o percentual de execução. */
function finish(map: Map<string, Bucket>): ExecutionRow[] {
  return [...map.values()]
    .map((bucket) => ({ ...bucket, executionRate: executionRate(bucket.liquidated, bucket.updatedBudget) }))
    .sort((a, b) => b.liquidated - a.liquidated);
}

function linesOf(actions: BudgetAction[]): ExpenseLine[] {
  return actions.flatMap((action) => action.expenseLines ?? []);
}

/** Soma geral — usada nos cartões de totais e para conferir se as visões fecham. */
export function totalsOf(actions: BudgetAction[]): ExecutionTotals {
  const totals = { ...EMPTY };
  for (const action of actions) addTotals(totals, action.totals);
  return totals;
}

// ── Por elemento de despesa ──────────────────────────────────────────────────

/**
 * Agrega por elemento de despesa (4ª posição da natureza da despesa).
 *
 * Linhas cujo código não puder ser interpretado caem no bucket `SEM_CLASSIFICACAO`
 * em vez de serem descartadas — assim a soma das linhas continua fechando com o
 * total geral, e um QDD com código fora do padrão fica visível em vez de sumir.
 */
export function aggregateByElement(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const nature = parseExpenseAccount(line.expenseAccount);
    const code = nature?.elementCode ?? 'SEM_CLASSIFICACAO';
    const name = nature
      ? expenseElementName(code, cleanExpenseDescription(line.expenseDescription ?? ''))
      : 'Sem classificação';
    const bucket = bucketOf(map, code, nature ? `${code} — ${name}` : name, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

/** Agrega por grupo de natureza da despesa (pessoal, investimentos, etc.). */
export function aggregateByGroup(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const nature = parseExpenseAccount(line.expenseAccount);
    const code = nature?.groupCode ?? 'SEM_CLASSIFICACAO';
    const name = nature ? EXPENSE_GROUPS[code] ?? `Grupo ${code}` : 'Sem classificação';
    const bucket = bucketOf(map, code, nature ? `${code} — ${name}` : name, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

// ── Por ação orçamentária ────────────────────────────────────────────────────

/** Agrega por ação (projeto/atividade + aplicação), o nível que o QDD já entrega. */
export function aggregateByAction(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const action of actions) {
    const application = action.application?.trim() || 'Sem descrição';
    const bucket = bucketOf(
      map,
      action.id,
      `${action.projectActivity} — ${application}`,
      application,
    );
    bucket.count += 1;
    addTotals(bucket, action.totals);
  }
  return finish(map);
}

/** Agrega por órgão — útil como filtro/visão cruzada em qualquer aba. */
export function aggregateByOrganization(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const action of actions) {
    const name = action.organizationName?.trim() || action.organizationCode;
    const bucket = bucketOf(map, action.organizationCode, `${action.organizationCode} — ${name}`, name);
    bucket.count += 1;
    addTotals(bucket, action.totals);
  }
  return finish(map);
}

// ── Emendas parlamentares ────────────────────────────────────────────────────

export type AmendmentType = 'INDIVIDUAL' | 'BANCADA' | 'COMISSAO' | 'RELATOR' | 'NAO_IDENTIFICADO';

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  INDIVIDUAL: 'Individuais',
  BANCADA: 'De bancada',
  COMISSAO: 'De comissão',
  RELATOR: 'De relator',
  NAO_IDENTIFICADO: 'Tipo não identificado',
};

/**
 * Deduz o tipo da emenda pelo rótulo da fonte de recurso.
 *
 * Só funciona para as fontes catalogadas em `fontes-recursos.ts` — que são as de
 * emendas **federais**. Emendas custeadas por fonte do tesouro estadual não têm o
 * tipo declarado no QDD e caem em `NAO_IDENTIFICADO`; isso é uma limitação do dado
 * de origem, não do cálculo.
 */
export function amendmentTypeFromSource(source: string | null | undefined): AmendmentType {
  const label = getFonteLabel(source)?.toLowerCase() ?? '';
  if (!label.includes('emenda')) return 'NAO_IDENTIFICADO';
  if (label.includes('individua')) return 'INDIVIDUAL';
  if (label.includes('bancada')) return 'BANCADA';
  if (label.includes('comiss')) return 'COMISSAO';
  if (label.includes('relator')) return 'RELATOR';
  return 'NAO_IDENTIFICADO';
}

/** Só as ações que são emenda parlamentar, pela regra já existente do projeto. */
export function amendmentActions(actions: BudgetAction[]): BudgetAction[] {
  return actions.filter((action) => actionIsAmendment(action));
}

/** Emendas agregadas por ação — o nível em que uma emenda aparece no QDD. */
export function aggregateAmendments(actions: BudgetAction[]): ExecutionRow[] {
  return aggregateByAction(amendmentActions(actions));
}

/**
 * Emendas agregadas por tipo. Percorre as linhas (a fonte está na linha), somando
 * apenas as linhas de ações que são emenda.
 */
export function aggregateAmendmentsByType(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(amendmentActions(actions))) {
    const type = amendmentTypeFromSource(line.source);
    const label = AMENDMENT_TYPE_LABELS[type];
    const bucket = bucketOf(map, type, label, label);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

// ── Por fonte de recurso ─────────────────────────────────────────────────────

/** Agrega por fonte de recurso, rotulando pelo catálogo oficial das fontes. */
export function aggregateBySource(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const code = line.source?.trim() || 'Sem fonte';
    const name = getFonteLabel(code) ?? 'Fonte não catalogada';
    const bucket = bucketOf(map, code, `${code} — ${name}`, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}
