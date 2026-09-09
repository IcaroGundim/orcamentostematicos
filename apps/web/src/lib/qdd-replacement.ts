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

/**
 * Quantas ações COM curadoria podem sumir do QDD sem barrar a publicação
 * automática. Inativar uma ação marcada a tira de todos os painéis e totais — a
 * curadoria sobrevive no banco, mas o número na tela muda sozinho. Em operação
 * normal esse valor é ZERO: as revisões de 28/08, 01/09 e 04/09 mantiveram 1.730
 * ações e só cresceram em linhas. A folga existe para churn legítimo pontual, não
 * para absorver um arquivo truncado.
 */
export const MAX_AUTO_INACTIVATE = 5;

/**
 * Piso da contagem de ações em relação à base vigente. O modo de falha real do
 * SICAF é uma exportação parcial: ela passa na checagem de "não vazio" do coletor
 * mas traz uma fração das ações, o que inativaria a curadoria em massa.
 */
export const MIN_ACTION_COUNT_RATIO = 0.9;

export type AutoPublishVerdict = { safe: true } | { safe: false; reason: string };

/**
 * Decide se uma coleta pode ser publicada SEM conferência humana. É o contrapeso
 * de ter tirado a confirmação manual do caminho diário: na ausência de alguém
 * olhando, quem precisa desconfiar do arquivo é o código.
 *
 * Não repete o que já está garantido em outro lugar — `planQddReplacement` nunca
 * apaga ação com curadoria, `syncStructureFromImport` só faz upsert e o
 * `fiscalYear.upsert` não altera a política de um exercício existente. O que sobra
 * de perigoso, e é o que se mede aqui, é o QDD **encolher**.
 */
export function assessAutoPublish(params: {
  plan: QddReplacementPlan;
  currentActionCount: number;
  incomingActionCount: number;
}): AutoPublishVerdict {
  const { plan, currentActionCount, incomingActionCount } = params;

  if (plan.inactivateIds.length > MAX_AUTO_INACTIVATE) {
    return {
      safe: false,
      reason:
        `${plan.inactivateIds.length} ações com curadoria sumiriam do QDD ` +
        `(limite automático: ${MAX_AUTO_INACTIVATE}).`,
    };
  }

  const floor = Math.floor(currentActionCount * MIN_ACTION_COUNT_RATIO);
  if (currentActionCount > 0 && incomingActionCount < floor) {
    return {
      safe: false,
      reason:
        `A coleta traz ${incomingActionCount} ações contra ${currentActionCount} da base ` +
        `vigente (mínimo automático: ${floor}). Exportação parcial?`,
    };
  }

  return { safe: true };
}
