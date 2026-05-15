export enum QddPeriodType {
  MesIsolado = 'MES_ISOLADO',
  AcumuladoAnual = 'ACUMULADO_ANUAL',
}

export enum UserRole {
  SeplanAdmin = 'SEPLAN_ADMIN',
  SecretariaRepresentante = 'SECRETARIA_REPRESENTANTE',
}

export enum ThemeBudget {
  Ocad = 'OCAD',
  Osg = 'OSG',
  Climatico = 'CLIMATICO',
}

export enum AssignmentStatus {
  Draft = 'RASCUNHO',
  Ready = 'PRONTO_PARA_VALIDACAO',
  Archived = 'ARQUIVADO',
}

export enum ValidationStatus {
  Draft = 'RASCUNHO',
  Submitted = 'ENVIADO',
  Returned = 'DEVOLVIDO',
  Approved = 'APROVADO',
}

export type OcadAxis = 'EDUCACAO' | 'SAUDE' | 'ASSISTENCIA_SOCIAL';
export type OsgAxis =
  | 'ASSISTENCIA_SOCIAL_DIREITOS_HUMANOS'
  | 'EDUCACAO'
  | 'SAUDE'
  | 'SEGURANCA'
  | 'ECONOMICO'
  | 'GOVERNANCA';
export type ClimaticoAxis =
  | 'DESENVOLVIMENTO_SUSTENTAVEL_BIOECONOMIA'
  | 'MITIGACAO'
  | 'ADAPTACAO'
  | 'JUSTICA_CLIMATICA_INCLUSAO_SOCIAL'
  | 'GOVERNANCA_AMBIENTAL_TRANSPARENCIA'
  | 'EDUCACAO_AMBIENTAL_INOVACAO'
  | 'GESTAO_RISCOS_PROTECAO_CIVIL';

export const THEME_AXES: Record<ThemeBudget, { value: string; label: string }[]> = {
  [ThemeBudget.Ocad]: [
    { value: 'EDUCACAO', label: 'Educação' },
    { value: 'SAUDE', label: 'Saúde' },
    { value: 'ASSISTENCIA_SOCIAL', label: 'Assistência Social' },
  ],
  [ThemeBudget.Osg]: [
    { value: 'ASSISTENCIA_SOCIAL_DIREITOS_HUMANOS', label: 'Assistência Social e Direitos Humanos' },
    { value: 'EDUCACAO', label: 'Educação' },
    { value: 'SAUDE', label: 'Saúde' },
    { value: 'SEGURANCA', label: 'Segurança' },
    { value: 'ECONOMICO', label: 'Econômico' },
    { value: 'GOVERNANCA', label: 'Governança' },
  ],
  [ThemeBudget.Climatico]: [
    { value: 'DESENVOLVIMENTO_SUSTENTAVEL_BIOECONOMIA', label: 'Desenvolvimento sustentável e bioeconomia' },
    { value: 'MITIGACAO', label: 'Mitigação das mudanças climáticas' },
    { value: 'ADAPTACAO', label: 'Adaptação climática' },
    { value: 'JUSTICA_CLIMATICA_INCLUSAO_SOCIAL', label: 'Justiça climática e inclusão social' },
    { value: 'GOVERNANCA_AMBIENTAL_TRANSPARENCIA', label: 'Governança ambiental e transparência' },
    { value: 'EDUCACAO_AMBIENTAL_INOVACAO', label: 'Educação ambiental e inovação' },
    { value: 'GESTAO_RISCOS_PROTECAO_CIVIL', label: 'Gestão de riscos e proteção civil' },
  ],
};

export const THEME_CLASSIFICATIONS: Record<ThemeBudget, { value: string; label: string }[]> = {
  [ThemeBudget.Ocad]: [
    { value: 'EXCLUSIVO', label: 'Exclusivo' },
    { value: 'NAO_EXCLUSIVO', label: 'Não exclusivo' },
  ],
  [ThemeBudget.Osg]: [
    { value: 'CATEGORIA_1', label: 'Categoria 1 - dotação exclusiva para mulheres' },
    { value: 'CATEGORIA_2', label: 'Categoria 2 - dotação genérica estratégica' },
    { value: 'CATEGORIA_3', label: 'Categoria 3 - dotação genérica não estratégica' },
  ],
  [ThemeBudget.Climatico]: [
    { value: 'EXCLUSIVA', label: 'Exclusiva' },
    { value: 'INDIRETA', label: 'Indireta' },
  ],
};

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationCode?: string;
  unitCode?: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  units: AdministrativeUnit[];
}

export interface AdministrativeUnit {
  id: string;
  code: string;
  name: string;
  organizationCode: string;
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
  totals: BudgetTotals;
  expenseLines: ExpenseLine[];
  assignmentIds: string[];
}

export interface BudgetTotals {
  initialBudget: number;
  supplemented: number;
  updatedBudget: number;
  committed: number;
  liquidated: number;
  paid: number;
  available: number;
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

export interface ThematicAssignment {
  id: string;
  actionId: string;
  theme: ThemeBudget;
  axis: string;
  classification: string;
  weightingFactor?: number;
  justification?: string;
  status: AssignmentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationCycle {
  id: string;
  name: string;
  year: number;
  theme: ThemeBudget;
  status: 'ABERTO' | 'ENCERRADO';
  openedAt: string;
  closedAt?: string;
}

export interface Evidence {
  id: string;
  label: string;
  url: string;
}

export interface DeliveryReport {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  municipality: string;
  beneficiaries: string;
}

export interface ActionValidation {
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
  submittedAt?: string;
  reviewedAt?: string;
  reviewerComment?: string;
  updatedAt: string;
}
