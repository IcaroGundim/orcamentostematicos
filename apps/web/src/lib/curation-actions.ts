import { api } from '@/lib/api';
import type { BudgetAction, Summary, ThematicAssignment } from '@/types/domain';

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

export async function syncCurationSnapshot(
  setActions: (actions: BudgetAction[]) => void,
  setSummary: (summary: Summary) => void,
) {
  const snapshot = await fetchCurationSnapshot();
  setActions(snapshot.actions);
  setSummary(snapshot.summary);
  return snapshot;
}
