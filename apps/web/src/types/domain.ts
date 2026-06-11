export type UserRole = 'SEPLAN_ADMIN' | 'SECRETARIA_REPRESENTANTE';
export type ThemeBudget = 'OCAD' | 'OSG' | 'CLIMATICO';
export type ValidationStatus = 'RASCUNHO' | 'ENVIADO' | 'DEVOLVIDO' | 'APROVADO';
export type QddPeriodType = 'MES_ISOLADO' | 'ACUMULADO_ANUAL';

export type GovernmentEntityType =
  | 'SECRETARIA'
  | 'AUTARQUIA'
  | 'FUNDACAO'
  | 'EMPRESA_PUBLICA'
  | 'FUNDO'
  | 'OUTRO';

export interface GovernmentUnitCatalog {
  code: string;
  name: string;
  active: boolean;
  relocated: boolean;
}

export interface GovernmentOrganizationCatalog {
  code: string;
  name: string;
  type: GovernmentEntityType;
  active: boolean;
  units: GovernmentUnitCatalog[];
}

export interface GovernmentStructure {
  organizations: GovernmentOrganizationCatalog[];
}

export interface StructureDiff {
  newOrganizations: Array<{ code: string; name: string }>;
  newUnits: Array<{
    organizationCode: string;
    organizationName: string;
    code: string;
    name: string;
  }>;
  missingOrganizations: Array<{
    code: string;
    name: string;
    type: GovernmentEntityType;
  }>;
  missingUnits: Array<{
    organizationCode: string;
    organizationName: string;
    code: string;
    name: string;
  }>;
  renamedOrganizations: Array<{ code: string; catalogName: string; qddName: string }>;
  renamedUnits: Array<{
    organizationCode: string;
    code: string;
    catalogName: string;
    qddName: string;
  }>;
  /**
   * Projeção das marcações temáticas sobre o QDD em conferência: quantas ações
   * classificadas hoje têm correspondência (serão mantidas) e quais ficarão sem
   * par no QDD selecionado.
   */
  markers?: {
    classifiedActions: number;
    preserved: number;
    unmatched: Array<{
      organizationCode: string;
      organizationName: string;
      unitCode: string;
      unitName: string;
      projectActivity: string;
      application: string;
    }>;
  };
}

export interface StructureDiffApplySelection {
  newOrganizationCodes?: string[];
  newUnits?: Array<{ organizationCode: string; code: string }>;
  renamedOrganizationCodes?: string[];
  renamedUnits?: Array<{ organizationCode: string; code: string }>;
  deactivateOrganizationCodes?: string[];
  deactivateUnits?: Array<{ organizationCode: string; code: string }>;
}

export interface UnitExecutionRow {
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
  /**
   * `null` = secretaria pai executa (default).
   * Igual ao próprio `unitCode` = unidade autônoma (ex.: FEM).
   * Outro `unitCode` = aquela unidade da mesma secretaria executa esta.
   */
  executorUnitCode: string | null;
}

export interface ExecutionStructure {
  organizations: Array<{
    code: string;
    name: string;
    units: UnitExecutionRow[];
  }>;
}

export interface BudgetImport {
  id: string;
  filename: string;
  year: number;
  referenceMonth: number;
  periodType: QddPeriodType;
  importedAt: string;
  rowCount: number;
  actionCount: number;
  status: 'VIGENTE' | 'HISTORICO';
}

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  role: UserRole;
  organizationCode?: string;
  unitCode?: string;
  active?: boolean;
  lastSeenAt?: string | null;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: UserRole;
  organizationCode: string | null;
  unitCode: string | null;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  sessionActive: boolean;
  pendingCuration: number;
  pendingDrafts: number;
  pendingReview: number;
  pendingValidation: number;
}

export interface UserActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  organizationCode: string | null;
  unitCode: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  units: { id: string; code: string; name: string; organizationCode: string }[];
}

export interface BudgetAction {
  id: string;
  year: number;
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
  application: string;
  functionalProgram: string;
  projectActivity: string;
  totals: {
    initialBudget: number;
    supplemented: number;
    updatedBudget: number;
    committed: number;
    liquidated: number;
    paid: number;
    available: number;
  };
  expenseLinesCount: number;
  expenseLines?: ExpenseLine[];
  assignments: ThematicAssignment[];
}

export interface ExpenseLine {
  id: string;
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
  application: string;
  functionalProgram: string;
  projectActivity: string;
  expenseAccount: string;
  expenseDescription: string;
  reduced: string;
  source: string;
  initialBudget: number;
  supplemented: number;
  updatedBudget: number;
  committed: number;
  liquidated: number;
  payableToLiquidate: number;
  paid: number;
  payable: number;
  available: number;
}

export interface ThematicAssignment {
  id: string;
  actionId: string;
  theme: ThemeBudget;
  axis: string;
  classification: string;
  weightingFactor?: number;
  justification?: string;
  status: 'RASCUNHO' | 'PRONTO_PARA_VALIDACAO' | 'ARQUIVADO';
}

export interface ValidationItem {
  id: string;
  cycleId: string;
  actionId: string;
  assignmentId: string;
  organizationCode: string;
  unitCode: string;
  theme: ThemeBudget;
  status: ValidationStatus;
  executionStatus?: string;
  realizedDescription?: string;
  deliveries: DeliveryReport[];
  informedExecutedValue?: number;
  evidences: Evidence[];
  observations?: string;
  reviewerComment?: string;
  action: BudgetAction;
  assignment: ThematicAssignment;
  cycle: { id: string; name: string; year: number; theme: ThemeBudget; status: string };
}

export interface DeliveryReport {
  id?: string;
  name?: string;
  description: string;
  quantity: number;
  municipality: string;
  beneficiaries: string;
  executedValue?: number;
}

export interface Evidence {
  id?: string;
  label: string;
  url: string;
}

export interface Metadata {
  themes: ThemeBudget[];
  axes: Record<ThemeBudget, { value: string; label: string }[]>;
  classifications: Record<ThemeBudget, { value: string; label: string }[]>;
  validationStatuses: ValidationStatus[];
}

export interface ValidationCycle {
  id: string;
  name: string;
  year: number;
  theme: ThemeBudget;
  status: 'ABERTO' | 'ENCERRADO';
  openedAt: string;
  closedAt?: string;
  validationCount: number;
  validationsByStatus: { status: ValidationStatus; count: number }[];
}

export interface Summary {
  actions: number;
  assignments: number;
  cycles: number;
  validations: number;
  totalsByTheme: { theme: ThemeBudget; actions: number; liquidated: number }[];
  totalsByClassification: {
    theme: ThemeBudget;
    classification: string;
    actions: number;
    liquidated: number;
  }[];
  validationsByStatus: { status: ValidationStatus; count: number }[];
}
