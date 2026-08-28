import { actionLogicalKey } from './qdd-parser';

export type ReplacementActionKey = {
  year: number;
  organizationCode: string;
  unitCode: string;
  projectActivity: string;
  application: string;
};

export type ExistingReplacementAction = ReplacementActionKey & {
  id: string;
  presentInCurrentQdd: boolean;
  hasAssignments: boolean;
  hasValidations: boolean;
};

export type QddReplacementPlan = {
  matches: Array<{ existingId: string; incomingIndex: number; reactivated: boolean }>;
  createIndexes: number[];
  inactivateIds: string[];
  deleteIds: string[];
};

/**
 * Planeja a atualização sem tocar no banco. Uma ação existente conserva o ID
 * sempre que a chave lógica reaparece; ausentes com curadoria são inativadas e
 * ausentes sem vínculos são descartadas.
 */
export function planQddReplacement(
  existing: ExistingReplacementAction[],
  incoming: ReplacementActionKey[],
): QddReplacementPlan {
  const existingByKey = new Map<string, ExistingReplacementAction>();
  for (const action of existing) {
    const key = actionLogicalKey(action);
    if (existingByKey.has(key)) {
      throw new Error(`A base atual contém ações duplicadas para a chave lógica ${key}.`);
    }
    existingByKey.set(key, action);
  }

  const seenIncoming = new Set<string>();
  const matchedExistingIds = new Set<string>();
  const matches: QddReplacementPlan['matches'] = [];
  const createIndexes: number[] = [];

  incoming.forEach((action, incomingIndex) => {
    const key = actionLogicalKey(action);
    if (seenIncoming.has(key)) {
      throw new Error(`O novo QDD contém ações duplicadas para a chave lógica ${key}.`);
    }
    seenIncoming.add(key);

    const current = existingByKey.get(key);
    if (!current) {
      createIndexes.push(incomingIndex);
      return;
    }
    matchedExistingIds.add(current.id);
    matches.push({
      existingId: current.id,
      incomingIndex,
      reactivated: !current.presentInCurrentQdd,
    });
  });

  const inactivateIds: string[] = [];
  const deleteIds: string[] = [];
  for (const action of existing) {
    if (matchedExistingIds.has(action.id)) continue;
    if (action.hasAssignments || action.hasValidations) {
      if (action.presentInCurrentQdd) inactivateIds.push(action.id);
    } else {
      deleteIds.push(action.id);
    }
  }

  return { matches, createIndexes, inactivateIds, deleteIds };
}
