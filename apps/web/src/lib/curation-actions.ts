import { api } from '@/lib/api';
import type { BudgetAction, Summary, ThematicAssignment, ThemeBudget } from '@/types/domain';

export function patchActionAssignments(
  actions: BudgetAction[],
  actionId: string,
  removedIds: Iterable<string>,
): BudgetAction[] {
  const removed = new Set(removedIds);
  return actions.map((action) => {
    if (action.id !== actionId) return action;
    const assignments = action.assignments.filter((item) => !removed.has(item.id));
    return {
      ...action,
      assignments,
      assignmentIds: assignments.map((item) => item.id),
    };
  });
}

export function patchBulkActionAssignments(
  actions: BudgetAction[],
  removedByAction: Map<string, Iterable<string>>,
): BudgetAction[] {
  if (removedByAction.size === 0) return actions;
  return actions.map((action) => {
    const removedIds = removedByAction.get(action.id);
    if (!removedIds) return action;
    const removed = new Set(removedIds);
    if (removed.size === 0) return action;
    const assignments = action.assignments.filter((item) => !removed.has(item.id));
    return {
      ...action,
      assignments,
      assignmentIds: assignments.map((item) => item.id),
    };
  });
}

export type BulkRemoveThemeFilter = ThemeBudget | 'ALL';

export type BulkRemoveAssignmentTarget = {
  actionId: string;
  assignmentId: string;
};

export function collectBulkRemoveTargets(
  actions: BudgetAction[],
  actionIds: Iterable<string>,
  themeFilter: BulkRemoveThemeFilter = 'ALL',
): BulkRemoveAssignmentTarget[] {
  const selected = new Set(actionIds);
  const targets: BulkRemoveAssignmentTarget[] = [];
  for (const action of actions) {
    if (!selected.has(action.id)) continue;
    for (const assignment of action.assignments) {
      if (themeFilter !== 'ALL' && assignment.theme !== themeFilter) continue;
      targets.push({ actionId: action.id, assignmentId: assignment.id });
    }
  }
  return targets;
}

export function appendActionAssignment(
  actions: BudgetAction[],
  actionId: string,
  assignment: ThematicAssignment,
): BudgetAction[] {
  return actions.map((action) => {
    if (action.id !== actionId) return action;
    const withoutSameTheme = action.assignments.filter((item) => item.theme !== assignment.theme);
    const assignments = [...withoutSameTheme, assignment];
    return {
      ...action,
      assignments,
      assignmentIds: assignments.map((item) => item.id),
    };
  });
}

/** @alias appendActionAssignment */
export const upsertActionAssignment = appendActionAssignment;

export function decrementSummaryAssignments(summary: Summary | null, count: number): Summary | null {
  if (!summary || count <= 0) return summary;
  return { ...summary, assignments: Math.max(0, summary.assignments - count) };
}

export function incrementSummaryAssignments(summary: Summary | null, count: number): Summary | null {
  if (!summary || count <= 0) return summary;
  return { ...summary, assignments: summary.assignments + count };
}

export async function fetchCurationSnapshot() {
  const [actions, summary] = await Promise.all([
    api<BudgetAction[]>('/budget-actions'),
    api<Summary>('/reports/summary'),
  ]);
  return { actions, summary };
}

/**
 * Um snapshot vindo do refetch é "suspeito" quando regride o que já temos em
 * tela: zera ações que existiam, ou perde todas as marcações que estavam
 * presentes. Isso acontece se o `GET /budget-actions` disparado logo após a
 * escrita voltar 200 vazio/degradado (leitura logo após o commit, cold start,
 * import vigente ambíguo). Nesses casos preservamos o estado otimista — que já
 * está correto — em vez de apagar a tela.
 */
export function isSnapshotSafe(current: BudgetAction[], fresh: BudgetAction[]): boolean {
  if (current.length > 0 && fresh.length === 0) return false;
  const countAssignments = (list: BudgetAction[]) =>
    list.reduce((total, action) => total + action.assignments.length, 0);
  if (countAssignments(current) > 0 && countAssignments(fresh) === 0) return false;
  return true;
}

/**
 * Refetch + aplicação segura do snapshot: só sobrescreve o estado se o snapshot
 * novo não for uma regressão (ver `isSnapshotSafe`). Retorna `true` se aplicou,
 * `false` se preservou o estado otimista. `current` deve ser o array JÁ com a
 * atualização otimista aplicada, para a comparação refletir o que o usuário vê.
 */
export async function reconcileCurationSnapshot(
  current: BudgetAction[],
  setActions: (actions: BudgetAction[]) => void,
  setSummary: (summary: Summary) => void,
): Promise<boolean> {
  const fresh = await fetchCurationSnapshot();
  if (!isSnapshotSafe(current, fresh.actions)) return false;
  setActions(fresh.actions);
  setSummary(fresh.summary);
  return true;
}

export async function syncCurationSnapshot(
  setActions: (actions: BudgetAction[]) => void,
  setSummary: (summary: Summary) => void,
) {
  const snapshot = await fetchCurationSnapshot();
  setActions(snapshot.actions);
  setSummary(snapshot.summary);
  return snapshot;
}
