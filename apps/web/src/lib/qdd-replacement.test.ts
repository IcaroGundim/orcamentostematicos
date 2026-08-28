import { describe, expect, it } from 'vitest';
import { planQddReplacement, type ExistingReplacementAction } from './qdd-replacement';

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
