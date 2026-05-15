import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActionValidation,
  AdministrativeUnit,
  AssignmentStatus,
  BudgetAction,
  BudgetImport,
  Organization,
  ThematicAssignment,
  ThemeBudget,
  User,
  UserRole,
  ValidationCycle,
  ValidationStatus,
} from '../common/domain';
import { qddVigenteActions, qddVigenteImport } from '../seeds/qdd-vigente.seed';

@Injectable()
export class DataStoreService {
  readonly users: User[] = [
    {
      id: 'user-seplan-admin',
      name: 'Administrador SEPLAN',
      email: 'admin@seplan.ac.gov.br',
      password: 'admin123',
      role: UserRole.SeplanAdmin,
    },
    {
      id: 'user-semulher',
      name: 'Representante SEMULHER',
      email: 'semulher@ac.gov.br',
      password: 'secretaria123',
      role: UserRole.SecretariaRepresentante,
      organizationCode: '762',
    },
    {
      id: 'user-sesacre',
      name: 'Representante SESACRE',
      email: 'sesacre@ac.gov.br',
      password: 'secretaria123',
      role: UserRole.SecretariaRepresentante,
      organizationCode: '721',
    },
  ];

  readonly sessions = new Map<string, string>();
  readonly organizations = new Map<string, Organization>();
  readonly imports = new Map<string, BudgetImport>();
  readonly assignments = new Map<string, ThematicAssignment>();
  readonly cycles = new Map<string, ValidationCycle>();
  readonly validations = new Map<string, ActionValidation>();

  private readonly actionsByImport = new Map<string, Map<string, BudgetAction>>();
  private vigenteImportId: string | null = null;

  get actions(): Map<string, BudgetAction> {
    if (!this.vigenteImportId) return new Map();
    return this.actionsByImport.get(this.vigenteImportId) ?? new Map();
  }

  constructor() {
    this.loadSeedBudgetData();
  }

  createId(prefix: string) {
    return `${prefix}-${randomUUID()}`;
  }

  private loadSeedBudgetData() {
    if (this.actionsByImport.size) {
      return;
    }
    this.imports.set(qddVigenteImport.id, qddVigenteImport);
    const seedMap = new Map<string, BudgetAction>();
    for (const action of qddVigenteActions) {
      seedMap.set(action.id, { ...action, assignmentIds: [] });
    }
    this.actionsByImport.set(qddVigenteImport.id, seedMap);
    this.vigenteImportId = qddVigenteImport.id;
    this.upsertOrganizations(qddVigenteActions);
  }

  resetBudgetData() {
    this.imports.clear();
    this.actionsByImport.clear();
    this.organizations.clear();
    this.assignments.clear();
    this.cycles.clear();
    this.validations.clear();
    this.vigenteImportId = null;
  }

  upsertOrganizations(actions: BudgetAction[]) {
    for (const action of actions) {
      const existing = this.organizations.get(action.organizationCode);
      const unit: AdministrativeUnit = {
        id: `${action.organizationCode}-${action.unitCode}`,
        code: action.unitCode,
        name: action.unitName,
        organizationCode: action.organizationCode,
      };

      if (!existing) {
        this.organizations.set(action.organizationCode, {
          id: action.organizationCode,
          code: action.organizationCode,
          name: action.organizationName,
          units: [unit],
        });
        continue;
      }

      if (!existing.units.some((item) => item.code === unit.code)) {
        existing.units.push(unit);
      }
    }
  }

  addImportedBudget(importRecord: BudgetImport, actions: BudgetAction[]) {
    if (this.vigenteImportId) {
      const current = this.imports.get(this.vigenteImportId);
      if (current) {
        this.imports.set(this.vigenteImportId, { ...current, status: 'HISTORICO' });
      }
    }

    this.imports.set(importRecord.id, importRecord);
    const actionMap = new Map<string, BudgetAction>();
    for (const action of actions) {
      actionMap.set(action.id, action);
    }
    this.actionsByImport.set(importRecord.id, actionMap);
    this.vigenteImportId = importRecord.id;

    this.organizations.clear();
    this.upsertOrganizations(actions);
  }

  listImports() {
    return [...this.imports.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  getImportActions(importId: string): BudgetAction[] {
    return [...(this.actionsByImport.get(importId)?.values() ?? [])];
  }

  listOrganizations() {
    return [...this.organizations.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  listActions(user: User, filters: ActionFilters) {
    const assignments = [...this.assignments.values()];
    return [...this.actions.values()]
      .filter((action) => canReadAction(user, action))
      .filter((action) => !filters.year || action.year === filters.year)
      .filter((action) => !filters.organizationCode || action.organizationCode === filters.organizationCode)
      .filter((action) => !filters.unitCode || action.unitCode === filters.unitCode)
      .filter((action) => {
        if (!filters.theme && !filters.axis && !filters.validationStatus) {
          return true;
        }
        const related = assignments.filter((assignment) => assignment.actionId === action.id);
        const matchingTheme = !filters.theme || related.some((assignment) => assignment.theme === filters.theme);
        const matchingAxis = !filters.axis || related.some((assignment) => assignment.axis === filters.axis);
        const matchingStatus =
          !filters.validationStatus ||
          [...this.validations.values()].some(
            (validation) => validation.actionId === action.id && validation.status === filters.validationStatus,
          );
        return matchingTheme && matchingAxis && matchingStatus;
      })
      .sort((a, b) => `${a.organizationCode}-${a.unitCode}-${a.projectActivity}`.localeCompare(`${b.organizationCode}-${b.unitCode}-${b.projectActivity}`));
  }

  getActionOrThrow(actionId: string) {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new NotFoundException('Ação orçamentária não encontrada.');
    }
    return action;
  }

  createAssignment(input: Omit<ThematicAssignment, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const assignment: ThematicAssignment = {
      ...input,
      id: this.createId('assignment'),
      status: input.status ?? AssignmentStatus.Ready,
      createdAt: now,
      updatedAt: now,
    };
    this.assignments.set(assignment.id, assignment);
    const action = this.getActionOrThrow(assignment.actionId);
    action.assignmentIds = [...new Set([...action.assignmentIds, assignment.id])];
    return assignment;
  }

  updateAssignment(id: string, patch: Partial<ThematicAssignment>) {
    const current = this.assignments.get(id);
    if (!current) {
      throw new NotFoundException('Classificação temática não encontrada.');
    }
    const updated = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    this.assignments.set(id, updated);
    return updated;
  }

  deleteAssignment(id: string) {
    const current = this.assignments.get(id);
    if (!current) {
      throw new NotFoundException('Classificação temática não encontrada.');
    }
    this.assignments.delete(id);
    const action = this.actions.get(current.actionId);
    if (action) {
      action.assignmentIds = action.assignmentIds.filter((assignmentId) => assignmentId !== id);
    }
  }

  createCycle(name: string, year: number, theme: ThemeBudget) {
    const cycle: ValidationCycle = {
      id: this.createId('cycle'),
      name,
      year,
      theme,
      status: 'ABERTO',
      openedAt: new Date().toISOString(),
    };
    this.cycles.set(cycle.id, cycle);

    const assignments = [...this.assignments.values()].filter(
      (assignment) => assignment.theme === theme && assignment.status === AssignmentStatus.Ready,
    );
    for (const assignment of assignments) {
      const action = this.actions.get(assignment.actionId);
      if (!action || action.year !== year) {
        continue;
      }
      const exists = [...this.validations.values()].some(
        (validation) => validation.cycleId === cycle.id && validation.assignmentId === assignment.id,
      );
      if (!exists) {
        const validationId = this.createId('validation');
        this.validations.set(validationId, {
          id: validationId,
          cycleId: cycle.id,
          actionId: action.id,
          assignmentId: assignment.id,
          organizationCode: action.organizationCode,
          unitCode: action.unitCode,
          theme,
          status: ValidationStatus.Draft,
          deliveries: [],
          evidences: [],
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return cycle;
  }

  listValidations(user: User) {
    return [...this.validations.values()]
      .filter((validation) => {
        if (user.role !== UserRole.SecretariaRepresentante) {
          return true;
        }
        return validation.organizationCode === user.organizationCode;
      })
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  getValidationOrThrow(id: string) {
    const validation = this.validations.get(id);
    if (!validation) {
      throw new NotFoundException('Validação não encontrada.');
    }
    return validation;
  }

  updateValidation(id: string, patch: Partial<ActionValidation>) {
    const current = this.getValidationOrThrow(id);
    const updated = {
      ...current,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.validations.set(id, updated);
    return updated;
  }

  getSummary(user: User) {
    const actions = this.listActions(user, {});
    const assignments = [...this.assignments.values()].filter((assignment) => actions.some((action) => action.id === assignment.actionId));
    const validations = this.listValidations(user);
    return {
      actions: actions.length,
      assignments: assignments.length,
      cycles: this.cycles.size,
      validations: validations.length,
      totalsByTheme: Object.values(ThemeBudget).map((theme) => {
        const themeAssignments = assignments.filter((assignment) => assignment.theme === theme);
        const actionIds = new Set(themeAssignments.map((assignment) => assignment.actionId));
        const liquidated = actions
          .filter((action) => actionIds.has(action.id))
          .reduce((total, action) => total + action.totals.liquidated, 0);
        return { theme, actions: actionIds.size, liquidated };
      }),
      validationsByStatus: Object.values(ValidationStatus).map((status) => ({
        status,
        count: validations.filter((validation) => validation.status === status).length,
      })),
    };
  }
}

export interface ActionFilters {
  year?: number;
  organizationCode?: string;
  unitCode?: string;
  theme?: ThemeBudget;
  axis?: string;
  validationStatus?: ValidationStatus;
}

export function canReadAction(user: User, action: BudgetAction) {
  if (user.role === UserRole.SecretariaRepresentante) {
    if (user.organizationCode && user.organizationCode !== action.organizationCode) {
      return false;
    }
    if (user.unitCode && user.unitCode !== action.unitCode) {
      return false;
    }
  }
  return true;
}
