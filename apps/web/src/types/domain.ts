export type UserRole = 'SEPLAN_ADMIN' | 'SECRETARIA_REPRESENTANTE' | 'SECRETARIA_REVISOR';
export type ThemeBudget = 'OCAD' | 'OSG' | 'CLIMATICO';
export type ValidationStatus =
  | 'RASCUNHO'
  | 'ENVIADO_REVISOR'
  | 'DEVOLVIDO_REVISOR'
  | 'APROVADO_REVISOR'
  | 'ENVIADO'
  | 'DEVOLVIDO'
  | 'APROVADO';
export type QddPeriodType = 'MES_ISOLADO' | 'ACUMULADO_ANUAL';

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
  role: UserRole;
  organizationCode?: string;
  unitCode?: string;
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
  internalReviewerComment?: string;
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
  validationsByStatus: { status: ValidationStatus; count: number }[];
}
