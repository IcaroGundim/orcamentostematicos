import { describe, expect, it } from 'vitest';
import {
  assessAutoPublish,
  MAX_AUTO_INACTIVATE,
  planQddReplacement,
  type ExistingReplacementAction,
  type QddReplacementPlan,
} from './qdd-replacement';

function action(overrides: Partial<ExistingReplacementAction> = {}): ExistingReplacementAction {
  return {
    id: 'action-1',
    year: 2026,
    organizationCode: '100',
    unitCode: '101',
    projectActivity: '2001',
    application: 'Atendimento à população',
    presentInCurrentQdd: true,
    hasAssignments: false,
    hasValidations: false,
    ...overrides,
  };
}

describe('planQddReplacement', () => {
  it('cria todas as ações na primeira importação', () => {
    const plan = planQddReplacement([], [action(), action({ projectActivity: '2002' })]);
    expect(plan.createIndexes).toEqual([0, 1]);
    expect(plan.matches).toEqual([]);
  });

  it('preserva o ID quando a chave lógica permanece', () => {
    const current = action();
    const plan = planQddReplacement([current], [{ ...current, application: '  Atendimento à população  ' }]);
    expect(plan.matches).toEqual([{ existingId: current.id, incomingIndex: 0, reactivated: false }]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('remove ação ausente sem curadoria', () => {
    const plan = planQddReplacement([action()], []);
    expect(plan.deleteIds).toEqual(['action-1']);
    expect(plan.inactivateIds).toEqual([]);
  });

  it('inativa ação ausente com marcação ou validação', () => {
    const plan = planQddReplacement([
      action({ id: 'marked', hasAssignments: true }),
      action({ id: 'validated', projectActivity: '2002', hasValidations: true }),
    ], []);
    expect(plan.inactivateIds).toEqual(['marked', 'validated']);
    expect(plan.deleteIds).toEqual([]);
  });

  it('reativa ação inativa que reaparece', () => {
    const inactive = action({ presentInCurrentQdd: false });
    const plan = planQddReplacement([inactive], [inactive]);
    expect(plan.matches[0]).toEqual({ existingId: inactive.id, incomingIndex: 0, reactivated: true });
  });

  it('mantém exercícios isolados pela chave lógica', () => {
    const current = action({ year: 2025 });
    const plan = planQddReplacement([current], [action({ year: 2026 })]);
    expect(plan.createIndexes).toEqual([0]);
    expect(plan.deleteIds).toEqual([current.id]);
  });

  it('aborta diante de chave lógica duplicada', () => {
    const duplicate = action({ id: 'action-2' });
    expect(() => planQddReplacement([action(), duplicate], [])).toThrow(/duplicadas/);
    expect(() => planQddReplacement([], [action(), duplicate])).toThrow(/duplicadas/);
  });
});

function plan(overrides: Partial<QddReplacementPlan> = {}): QddReplacementPlan {
  return { matches: [], createIndexes: [], inactivateIds: [], deleteIds: [], ...overrides };
}

describe('assessAutoPublish', () => {
  it('libera a coleta diária típica, que só acrescenta linhas', () => {
    const verdict = assessAutoPublish({
      plan: plan(),
      currentActionCount: 1730,
      incomingActionCount: 1730,
    });
    expect(verdict).toEqual({ safe: true });
  });

  it('libera crescimento da base', () => {
    const verdict = assessAutoPublish({
      plan: plan({ createIndexes: [0, 1] }),
      currentActionCount: 1730,
      incomingActionCount: 1732,
    });
    expect(verdict.safe).toBe(true);
  });

  it('barra quando ações com curadoria sumiriam em massa', () => {
    const verdict = assessAutoPublish({
      plan: plan({ inactivateIds: Array.from({ length: MAX_AUTO_INACTIVATE + 1 }, (_, i) => `a${i}`) }),
      currentActionCount: 1730,
      incomingActionCount: 1730,
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.safe === false && verdict.reason).toMatch(/curadoria/);
  });

  it('tolera churn pontual dentro do limite', () => {
    const verdict = assessAutoPublish({
      plan: plan({ inactivateIds: ['a1'] }),
      currentActionCount: 1730,
      incomingActionCount: 1729,
    });
    expect(verdict.safe).toBe(true);
  });

  it('barra exportação parcial do SICAF', () => {
    const verdict = assessAutoPublish({
      plan: plan(),
      currentActionCount: 1730,
      incomingActionCount: 200,
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.safe === false && verdict.reason).toMatch(/parcial/);
  });

  it('não aplica o piso quando ainda não há base vigente', () => {
    const verdict = assessAutoPublish({
      plan: plan(),
      currentActionCount: 0,
      incomingActionCount: 1730,
    });
    expect(verdict.safe).toBe(true);
  });
});
