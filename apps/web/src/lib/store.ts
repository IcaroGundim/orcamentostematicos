/**
 * Shared data-access helpers used by Next.js API Route Handlers.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';

export function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

// ── Vigente import ───────────────────────────────────────────────────────────

export async function getVigenteImportId(): Promise<string | null> {
  const row = await prisma.budgetImport.findFirst({
    where: { status: 'VIGENTE' },
    select: { id: true },
  });
  return row?.id ?? null;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function listActions(user: { role: string; organizationCode?: string | null; unitCode?: string | null }, filters: {
  year?: number;
  organizationCode?: string;
  unitCode?: string;
}) {
  const vigenteId = await getVigenteImportId();
  if (!vigenteId) return [];

  const where: Record<string, unknown> = { importId: vigenteId };
  if (filters.year) where['year'] = filters.year;

  if (user.role === 'SECRETARIA_REPRESENTANTE') {
    if (!user.organizationCode) return [];
    where['organizationCode'] = user.organizationCode;
    if (user.unitCode) where['unitCode'] = user.unitCode;
  } else if (user.role === 'SECRETARIA_REVISOR') {
    if (!user.organizationCode) return [];
    where['organizationCode'] = user.organizationCode;
  } else {
    if (filters.organizationCode) where['organizationCode'] = filters.organizationCode;
    if (filters.unitCode) where['unitCode'] = filters.unitCode;
  }

  const rows = await prisma.budgetAction.findMany({
    where,
    include: { expenseLines: true, assignments: true },
    orderBy: [{ organizationCode: 'asc' }, { unitCode: 'asc' }, { projectActivity: 'asc' }],
  });
  return rows.map(mapAction);
}

// ── Organizations ────────────────────────────────────────────────────────────

export async function listOrganizations() {
  const vigenteId = await getVigenteImportId();
  if (!vigenteId) return [];

  const actions = await prisma.budgetAction.findMany({
    where: { importId: vigenteId },
    select: { organizationCode: true, organizationName: true, unitCode: true, unitName: true },
  });

  const map = new Map<string, { id: string; code: string; name: string; units: { id: string; code: string; name: string; organizationCode: string }[] }>();
  for (const a of actions) {
    if (!map.has(a.organizationCode)) {
      map.set(a.organizationCode, { id: a.organizationCode, code: a.organizationCode, name: a.organizationName, units: [] });
    }
    const org = map.get(a.organizationCode)!;
    if (!org.units.some((u) => u.code === a.unitCode)) {
      org.units.push({ id: `${a.organizationCode}-${a.unitCode}`, code: a.unitCode, name: a.unitName, organizationCode: a.organizationCode });
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

// ── Summary ──────────────────────────────────────────────────────────────────

export async function getSummary(user: { role: string; organizationCode?: string | null; unitCode?: string | null }) {
  const [actions, assignments, cycles, validations] = await Promise.all([
    listActions(user, {}),
    prisma.thematicAssignment.findMany(),
    prisma.validationCycle.findMany(),
    listValidations(user),
  ]);

  const actionIds = new Set(actions.map((a) => a.id));
  const userAssignments = uniqueAssignmentsByActionTheme(assignments.filter((a) => actionIds.has(a.actionId)));

  const themes = ['OCAD', 'OSG', 'CLIMATICO'];
  const statuses = ['RASCUNHO', 'ENVIADO_REVISOR', 'DEVOLVIDO_REVISOR', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'];

  return {
    actions: actions.length,
    assignments: userAssignments.length,
    cycles: cycles.length,
    validations: validations.length,
    totalsByTheme: themes.map((theme) => {
      const themeAssignments = userAssignments.filter((a) => a.theme === theme);
      const themedActionIds = new Set(themeAssignments.map((a) => a.actionId));
      const liquidated = actions.filter((a) => themedActionIds.has(a.id)).reduce((s, a) => s + a.totals.liquidated, 0);
      return { theme, actions: themedActionIds.size, liquidated };
    }),
    validationsByStatus: statuses.map((status) => ({
      status,
      count: validations.filter((v) => v.status === status).length,
    })),
  };
}

// ── Validations ──────────────────────────────────────────────────────────────

export async function listValidations(user: { role: string; organizationCode?: string | null; unitCode?: string | null }) {
  const where: Record<string, unknown> = {};
  if (user.role === 'SECRETARIA_REPRESENTANTE' && user.organizationCode) {
    where['organizationCode'] = user.organizationCode;
    if (user.unitCode) where['unitCode'] = user.unitCode;
  } else if (user.role === 'SECRETARIA_REVISOR' && user.organizationCode) {
    where['organizationCode'] = user.organizationCode;
  }
  const rows = await prisma.actionValidation.findMany({
    where,
    include: {
      action: { include: { expenseLines: true, assignments: true } },
      assignment: true,
      cycle: true,
    },
    orderBy: { updatedAt: 'asc' },
  });
  return rows.map(mapValidation);
}

/**
 * Retorna o ciclo de validação implícito do par tema/exercício, criando-o se
 * ainda não existir. O ciclo deixou de ser aberto manualmente pela SEPLAN:
 * agora ele só agrupa as validações geradas automaticamente na classificação.
 */
export async function getOrCreateImplicitCycle(theme: string, year: number): Promise<{ id: string }> {
  const existing = await prisma.validationCycle.findFirst({
    where: { theme: theme as any, year, status: 'ABERTO' },
    select: { id: true },
  });
  if (existing) return existing;

  try {
    return await prisma.validationCycle.create({
      data: { name: `Acompanhamento ${theme} ${year}`, year, theme: theme as any, status: 'ABERTO' },
      select: { id: true },
    });
  } catch {
    // Corrida: outra classificação simultânea pode ter criado o ciclo.
    const created = await prisma.validationCycle.findFirst({
      where: { theme: theme as any, year, status: 'ABERTO' },
      select: { id: true },
    });
    if (created) return created;
    throw new Error('Não foi possível obter o ciclo de validação para este tema/exercício.');
  }
}

/**
 * Uma validação RASCUNHO "vazia" é aquela auto-criada na classificação e ainda
 * não tocada pela secretaria. Só essas podem ser apagadas junto da classificação.
 */
export function isEmptyDraftValidation(v: {
  status: string;
  deliveries?: unknown;
  realizedDescription?: string | null;
  executionStatus?: string | null;
  observations?: string | null;
  informedExecutedValue?: number | null;
}): boolean {
  if (v.status !== 'RASCUNHO') return false;
  const deliveries = Array.isArray(v.deliveries) ? v.deliveries : [];
  if (deliveries.length > 0) return false;
  if (v.realizedDescription) return false;
  if (v.executionStatus) return false;
  if (v.observations) return false;
  if (v.informedExecutedValue != null && v.informedExecutedValue !== 0) return false;
  return true;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

export function mapAction(row: any) {
  const assignments = uniqueAssignmentsByActionTheme(row.assignments ?? []);

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
      id: l.id, organizationCode: l.organizationCode, organizationName: l.organizationName,
      unitCode: l.unitCode, unitName: l.unitName, application: l.application,
      functionalProgram: l.functionalProgram, projectActivity: l.projectActivity,
      expenseAccount: l.expenseAccount, expenseDescription: l.expenseDescription,
      reduced: l.reduced, source: l.source, initialBudget: l.initialBudget,
      supplemented: l.supplemented, updatedBudget: l.updatedBudget, committed: l.committed,
      liquidated: l.liquidated, payableToLiquidate: l.payableToLiquidate,
      paid: l.paid, payable: l.payable, available: l.available,
    })),
    expenseLinesCount: row.expenseLines?.length ?? 0,
    assignments: assignments.map(mapAssignment),
    assignmentIds: assignments.map((a: any) => a.id),
  };
}

export function mapAssignment(row: any) {
  return {
    id: row.id, actionId: row.actionId, theme: row.theme, axis: row.axis,
    classification: row.classification, weightingFactor: row.weightingFactor ?? undefined,
    justification: row.justification ?? undefined, status: row.status, createdBy: row.createdBy,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function mapImport(row: any) {
  return {
    id: row.id, filename: row.filename, year: row.year, referenceMonth: row.referenceMonth,
    periodType: row.periodType, importedAt: row.importedAt instanceof Date ? row.importedAt.toISOString() : row.importedAt,
    rowCount: row.rowCount, actionCount: row.actionCount, status: row.status,
  };
}

export function mapCycle(row: any) {
  return {
    id: row.id, name: row.name, year: row.year, theme: row.theme, status: row.status,
    openedAt: row.openedAt instanceof Date ? row.openedAt.toISOString() : row.openedAt,
    closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : (row.closedAt ?? undefined),
  };
}

export function mapValidation(row: any) {
  return {
    id: row.id,
    cycleId: row.cycleId,
    actionId: row.actionId,
    assignmentId: row.assignmentId,
    organizationCode: row.organizationCode,
    unitCode: row.unitCode,
    theme: row.theme,
    status: row.status,
    executionStatus: row.executionStatus ?? undefined,
    realizedDescription: row.realizedDescription ?? undefined,
    deliveries: Array.isArray(row.deliveries) ? row.deliveries : [],
    informedExecutedValue: row.informedExecutedValue ?? undefined,
    evidences: Array.isArray(row.evidences) ? row.evidences : [],
    observations: row.observations ?? undefined,
    reviewerComment: row.reviewerComment ?? undefined,
    internalReviewerComment: row.internalReviewerComment ?? undefined,
    action: row.action ? mapAction(row.action) : undefined,
    assignment: row.assignment ? mapAssignment(row.assignment) : undefined,
    cycle: row.cycle ? mapCycle(row.cycle) : undefined,
  };
}

// ── addImportedBudget ────────────────────────────────────────────────────────

export async function addImportedBudget(importRecord: any, actions: any[]) {
  await prisma.$transaction(async (tx) => {
    await tx.budgetImport.updateMany({ where: { status: 'VIGENTE' }, data: { status: 'HISTORICO' } });
    await tx.budgetImport.create({
      data: {
        id: importRecord.id, filename: importRecord.filename, year: importRecord.year,
        referenceMonth: importRecord.referenceMonth, periodType: importRecord.periodType,
        importedAt: new Date(importRecord.importedAt), rowCount: importRecord.rowCount,
        actionCount: importRecord.actionCount, status: 'VIGENTE',
      },
    });

    await createInBatches(tx.budgetAction, actions.map((action) => ({
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
    })));

    const lines = actions.flatMap((action) => action.expenseLines.map((line: any) => ({
      id: line.id,
      actionId: action.id,
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
    })));

    await createInBatches(tx.expenseLine, lines);
  }, {
    maxWait: 10000,
    timeout: 60000,
  });
}

async function createInBatches(model: { createMany: (args: { data: any[] }) => Promise<unknown> }, data: any[], batchSize = 2000) {
  for (let index = 0; index < data.length; index += batchSize) {
    const batch = data.slice(index, index + batchSize);
    if (batch.length) {
      await model.createMany({ data: batch });
    }
  }
}

function uniqueAssignmentsByActionTheme<T extends { actionId: string; theme: string; createdAt?: Date | string }>(assignments: T[]) {
  const byKey = new Map<string, T>();
  for (const assignment of assignments) {
    const key = `${assignment.actionId}:${assignment.theme}`;
    const existing = byKey.get(key);
    if (!existing || String(assignment.createdAt ?? '') > String(existing.createdAt ?? '')) {
      byKey.set(key, assignment);
    }
  }
  return [...byKey.values()];
}
