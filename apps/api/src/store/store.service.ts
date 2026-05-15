import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActionValidation,
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
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataStoreService {
  constructor(private readonly prisma: PrismaService) {}

  createId(prefix: string) {
    return `${prefix}-${randomUUID()}`;
  }

  // ── Users & Sessions ────────────────────────────────────────────────────────

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? this.mapUser(user) : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  async createSession(token: string, userId: string): Promise<void> {
    await this.prisma.session.create({ data: { token, userId } });
  }

  async getUserByToken(token: string): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    return session ? this.mapUser(session.user) : null;
  }

  // ── Imports & Actions ───────────────────────────────────────────────────────

  async listImports(): Promise<BudgetImport[]> {
    const rows = await this.prisma.budgetImport.findMany({
      orderBy: { importedAt: 'desc' },
    });
    return rows.map(this.mapImport);
  }

  async getVigenteImportId(): Promise<string | null> {
    const row = await this.prisma.budgetImport.findFirst({
      where: { status: 'VIGENTE' },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async getImportActions(importId: string): Promise<BudgetAction[]> {
    const rows = await this.prisma.budgetAction.findMany({
      where: { importId },
      include: { expenseLines: true },
    });
    return rows.map(this.mapAction);
  }

  async listActions(user: User, filters: ActionFilters): Promise<BudgetAction[]> {
    const vigenteId = await this.getVigenteImportId();
    if (!vigenteId) return [];

    const where: Record<string, unknown> = { importId: vigenteId };
    if (user.role === UserRole.SecretariaRepresentante) {
      if (user.organizationCode) where['organizationCode'] = user.organizationCode;
      if (user.unitCode) where['unitCode'] = user.unitCode;
    }
    if (filters.year) where['year'] = filters.year;
    if (filters.organizationCode) where['organizationCode'] = filters.organizationCode;
    if (filters.unitCode) where['unitCode'] = filters.unitCode;

    const rows = await this.prisma.budgetAction.findMany({
      where,
      include: { expenseLines: true, assignments: true },
      orderBy: [{ organizationCode: 'asc' }, { unitCode: 'asc' }, { projectActivity: 'asc' }],
    });
    return rows.map(this.mapAction);
  }

  async getActionOrThrow(actionId: string): Promise<BudgetAction> {
    const row = await this.prisma.budgetAction.findUnique({
      where: { id: actionId },
      include: { expenseLines: true, assignments: true },
    });
    if (!row) throw new NotFoundException('Ação orçamentária não encontrada.');
    return this.mapAction(row);
  }

  async addImportedBudget(importRecord: BudgetImport, actions: BudgetAction[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.budgetImport.updateMany({
        where: { status: 'VIGENTE' },
        data: { status: 'HISTORICO' },
      });

      await tx.budgetImport.create({
        data: {
          id: importRecord.id,
          filename: importRecord.filename,
          year: importRecord.year,
          referenceMonth: importRecord.referenceMonth,
          periodType: importRecord.periodType as string,
          importedAt: new Date(importRecord.importedAt),
          rowCount: importRecord.rowCount,
          actionCount: importRecord.actionCount,
          status: 'VIGENTE',
        },
      });

      for (const action of actions) {
        await tx.budgetAction.create({
          data: {
            id: action.id,
            importId: importRecord.id,
            year: action.year,
            organizationCode: action.organizationCode,
            organizationName: action.organizationName,
            unitCode: action.unitCode,
            unitName: action.unitName,
            application: action.application,
            functionalProgram: action.functionalProgram,
            projectActivity: action.projectActivity,
            initialBudget: action.totals.initialBudget,
            supplemented: action.totals.supplemented,
            updatedBudget: action.totals.updatedBudget,
            committed: action.totals.committed,
            liquidated: action.totals.liquidated,
            paid: action.totals.paid,
            available: action.totals.available,
            expenseLines: {
              create: action.expenseLines.map((line) => ({
                id: line.id,
                organizationCode: line.organizationCode,
                organizationName: line.organizationName,
                unitCode: line.unitCode,
                unitName: line.unitName,
                application: line.application,
                functionalProgram: line.functionalProgram,
                projectActivity: line.projectActivity,
                expenseAccount: line.expenseAccount,
                expenseDescription: line.expenseDescription,
                reduced: line.reduced,
                source: line.source,
                initialBudget: line.initialBudget,
                supplemented: line.supplemented,
                updatedBudget: line.updatedBudget,
                committed: line.committed,
                liquidated: line.liquidated,
                payableToLiquidate: line.payableToLiquidate,
                paid: line.paid,
                payable: line.payable,
                available: line.available,
              })),
            },
          },
        });
      }
    });
  }

  // ── Organizations ───────────────────────────────────────────────────────────

  async listOrganizations(): Promise<Organization[]> {
    const vigenteId = await this.getVigenteImportId();
    if (!vigenteId) return [];

    const actions = await this.prisma.budgetAction.findMany({
      where: { importId: vigenteId },
      select: { organizationCode: true, organizationName: true, unitCode: true, unitName: true },
    });

    const map = new Map<string, Organization>();
    for (const a of actions) {
      if (!map.has(a.organizationCode)) {
        map.set(a.organizationCode, {
          id: a.organizationCode,
          code: a.organizationCode,
          name: a.organizationName,
          units: [],
        });
      }
      const org = map.get(a.organizationCode)!;
      if (!org.units.some((u) => u.code === a.unitCode)) {
        org.units.push({
          id: `${a.organizationCode}-${a.unitCode}`,
          code: a.unitCode,
          name: a.unitName,
          organizationCode: a.organizationCode,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  // ── Thematic Assignments ────────────────────────────────────────────────────

  async createAssignment(input: Omit<ThematicAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ThematicAssignment> {
    const row = await this.prisma.thematicAssignment.create({
      data: {
        actionId: input.actionId,
        theme: input.theme as string,
        axis: input.axis,
        classification: input.classification,
        weightingFactor: input.weightingFactor,
        justification: input.justification,
        status: (input.status ?? AssignmentStatus.Ready) as string,
        createdBy: input.createdBy,
      },
    });
    return this.mapAssignment(row);
  }

  async updateAssignment(id: string, patch: Partial<ThematicAssignment>): Promise<ThematicAssignment> {
    const row = await this.prisma.thematicAssignment.update({
      where: { id },
      data: {
        ...(patch.theme && { theme: patch.theme as string }),
        ...(patch.axis !== undefined && { axis: patch.axis }),
        ...(patch.classification !== undefined && { classification: patch.classification }),
        ...(patch.weightingFactor !== undefined && { weightingFactor: patch.weightingFactor }),
        ...(patch.justification !== undefined && { justification: patch.justification }),
        ...(patch.status && { status: patch.status as string }),
      },
    });
    return this.mapAssignment(row);
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.prisma.thematicAssignment.delete({ where: { id } });
  }

  async listAssignments(): Promise<ThematicAssignment[]> {
    const rows = await this.prisma.thematicAssignment.findMany();
    return rows.map(this.mapAssignment);
  }

  // ── Validation Cycles ───────────────────────────────────────────────────────

  async createCycle(name: string, year: number, theme: ThemeBudget): Promise<ValidationCycle> {
    const cycle = await this.prisma.validationCycle.create({
      data: { name, year, theme: theme as string, status: 'ABERTO' },
    });

    const assignments = await this.prisma.thematicAssignment.findMany({
      where: { theme: theme as string, status: AssignmentStatus.Ready as string },
    });

    const actionIds = assignments.map((a) => a.actionId);
    const actions = await this.prisma.budgetAction.findMany({
      where: { id: { in: actionIds }, year },
    });
    const actionSet = new Set(actions.map((a) => a.id));

    await this.prisma.actionValidation.createMany({
      data: assignments
        .filter((a) => actionSet.has(a.actionId))
        .map((a) => {
          const action = actions.find((ac) => ac.id === a.actionId)!;
          return {
            cycleId: cycle.id,
            actionId: a.actionId,
            assignmentId: a.id,
            organizationCode: action.organizationCode,
            unitCode: action.unitCode,
            theme: theme as string,
            status: ValidationStatus.Draft as string,
            deliveries: [],
            evidences: [],
          };
        }),
      skipDuplicates: true,
    });

    return this.mapCycle(cycle);
  }

  async listCycles(): Promise<ValidationCycle[]> {
    const rows = await this.prisma.validationCycle.findMany({ orderBy: { openedAt: 'desc' } });
    return rows.map(this.mapCycle);
  }

  async getCycleWithValidations(id: string) {
    return this.prisma.validationCycle.findUnique({
      where: { id },
      include: { validations: true },
    });
  }

  async closeCycle(id: string) {
    return this.prisma.validationCycle.update({
      where: { id },
      data: { status: 'ENCERRADO', closedAt: new Date() },
    });
  }

  async deleteCycle(id: string): Promise<void> {
    await this.prisma.validationCycle.delete({ where: { id } });
  }

  // ── Validations ─────────────────────────────────────────────────────────────

  async listValidations(user: User) {
    const where: Record<string, unknown> = {};
    if (user.role === UserRole.SecretariaRepresentante && user.organizationCode) {
      where['organizationCode'] = user.organizationCode;
    }
    return this.prisma.actionValidation.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
    });
  }

  async getValidationOrThrow(id: string) {
    const row = await this.prisma.actionValidation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Validação não encontrada.');
    return row;
  }

  async updateValidation(id: string, patch: Partial<ActionValidation>) {
    return this.prisma.actionValidation.update({
      where: { id },
      data: {
        ...(patch.status && { status: patch.status as string }),
        ...(patch.executionStatus !== undefined && { executionStatus: patch.executionStatus }),
        ...(patch.realizedDescription !== undefined && { realizedDescription: patch.realizedDescription }),
        ...(patch.informedExecutedValue !== undefined && { informedExecutedValue: patch.informedExecutedValue }),
        ...(patch.observations !== undefined && { observations: patch.observations }),
        ...(patch.deliveries !== undefined && { deliveries: patch.deliveries }),
        ...(patch.evidences !== undefined && { evidences: patch.evidences }),
        ...(patch.submittedAt !== undefined && { submittedAt: patch.submittedAt ? new Date(patch.submittedAt) : null }),
        ...(patch.reviewedAt !== undefined && { reviewedAt: patch.reviewedAt ? new Date(patch.reviewedAt) : null }),
        ...(patch.reviewerComment !== undefined && { reviewerComment: patch.reviewerComment ?? null }),
      },
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  async getSummary(user: User) {
    const [actions, assignments, cycles, validations] = await Promise.all([
      this.listActions(user, {}),
      this.listAssignments(),
      this.listCycles(),
      this.listValidations(user),
    ]);

    const actionIds = new Set(actions.map((a) => a.id));
    const userAssignments = assignments.filter((a) => actionIds.has(a.actionId));

    return {
      actions: actions.length,
      assignments: userAssignments.length,
      cycles: cycles.length,
      validations: validations.length,
      totalsByTheme: Object.values(ThemeBudget).map((theme) => {
        const themeAssignments = userAssignments.filter((a) => a.theme === theme);
        const themedActionIds = new Set(themeAssignments.map((a) => a.actionId));
        const liquidated = actions
          .filter((a) => themedActionIds.has(a.id))
          .reduce((s, a) => s + a.totals.liquidated, 0);
        return { theme, actions: themedActionIds.size, liquidated };
      }),
      validationsByStatus: Object.values(ValidationStatus).map((status) => ({
        status,
        count: validations.filter((v) => v.status === status).length,
      })),
    };
  }

  // ── Mappers ─────────────────────────────────────────────────────────────────

  private mapUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role as UserRole,
      organizationCode: row.organizationCode ?? undefined,
      unitCode: row.unitCode ?? undefined,
    };
  }

  private mapImport(row: any): BudgetImport {
    return {
      id: row.id,
      filename: row.filename,
      year: row.year,
      referenceMonth: row.referenceMonth,
      periodType: row.periodType,
      importedAt: row.importedAt instanceof Date ? row.importedAt.toISOString() : row.importedAt,
      rowCount: row.rowCount,
      actionCount: row.actionCount,
      status: row.status,
    };
  }

  private mapAction(row: any): BudgetAction {
    return {
      id: row.id,
      year: row.year,
      organizationCode: row.organizationCode,
      organizationName: row.organizationName,
      unitCode: row.unitCode,
      unitName: row.unitName,
      application: row.application,
      functionalProgram: row.functionalProgram,
      projectActivity: row.projectActivity,
      totals: {
        initialBudget: row.initialBudget,
        supplemented: row.supplemented,
        updatedBudget: row.updatedBudget,
        committed: row.committed,
        liquidated: row.liquidated,
        paid: row.paid,
        available: row.available,
      },
      expenseLines: (row.expenseLines ?? []).map((l: any) => ({
        id: l.id,
        organizationCode: l.organizationCode,
        organizationName: l.organizationName,
        unitCode: l.unitCode,
        unitName: l.unitName,
        application: l.application,
        functionalProgram: l.functionalProgram,
        projectActivity: l.projectActivity,
        expenseAccount: l.expenseAccount,
        expenseDescription: l.expenseDescription,
        reduced: l.reduced,
        source: l.source,
        initialBudget: l.initialBudget,
        supplemented: l.supplemented,
        updatedBudget: l.updatedBudget,
        committed: l.committed,
        liquidated: l.liquidated,
        payableToLiquidate: l.payableToLiquidate,
        paid: l.paid,
        payable: l.payable,
        available: l.available,
      })),
      assignmentIds: (row.assignments ?? []).map((a: any) => a.id),
    };
  }

  private mapAssignment(row: any): ThematicAssignment {
    return {
      id: row.id,
      actionId: row.actionId,
      theme: row.theme as ThemeBudget,
      axis: row.axis,
      classification: row.classification,
      weightingFactor: row.weightingFactor ?? undefined,
      justification: row.justification ?? undefined,
      status: row.status as AssignmentStatus,
      createdBy: row.createdBy,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  private mapCycle(row: any): ValidationCycle {
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      theme: row.theme as ThemeBudget,
      status: row.status,
      openedAt: row.openedAt instanceof Date ? row.openedAt.toISOString() : row.openedAt,
      closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : (row.closedAt ?? undefined),
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
    if (user.organizationCode && user.organizationCode !== action.organizationCode) return false;
    if (user.unitCode && user.unitCode !== action.unitCode) return false;
  }
  return true;
}
