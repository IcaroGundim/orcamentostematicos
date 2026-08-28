/**
 * Shared data-access helpers used by Next.js API Route Handlers.
 */
import 'server-only';

import { randomUUID } from 'node:crypto';
import { listGovernmentStructure } from './government-structure';
import { prisma } from './prisma';
import { buildVerifiedDeliveryExecutedMap, thematicBudgetContribution } from './classification-rules';
import { planQddReplacement } from './qdd-replacement';

export function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

// ── Exercícios financeiros ───────────────────────────────────────────────────

/**
 * Exercício corrente: aquele marcado `isCurrent` em `FiscalYear`.
 *
 * **Isto é uma fronteira de autorização, não só um padrão de tela.** Seis rotas de
 * escrita das secretarias comparam com este valor (classificar, editar e remover
 * marcação, rascunho, envio e envio em lote). Trocar o corrente derruba o acesso de
 * escrita ao exercício anterior — por isso a troca é um ato de governança na tela da
 * SEPLAN, jamais efeito do seletor do cabeçalho.
 *
 * Enquanto NENHUM ano estiver marcado, vale o ano mais recente com QDD vigente — o
 * comportamento anterior, preservado para que nada precisasse ser semeado. Depois da
 * primeira marcação esse fallback nunca mais roda.
 */
export async function getCurrentYear(): Promise<number | null> {
  const flagged = await prisma.fiscalYear.findMany({
    where: { isCurrent: true },
    orderBy: { year: 'desc' },
    select: { year: true },
  });
  if (flagged.length > 1) {
    console.warn(
      `[getCurrentYear] Invariante violada: ${flagged.length} exercícios marcados como ` +
        `corrente (${flagged.map((r) => r.year).join(', ')}). Usando o mais recente.`,
    );
  }
  if (flagged[0]) return flagged[0].year;

  const row = await prisma.budgetImport.findFirst({
    orderBy: [{ year: 'desc' }, { importedAt: 'desc' }],
    select: { year: true },
  });
  return row?.year ?? null;
}

/**
 * Marca um exercício como corrente, zerando os demais na mesma transação — a
 * invariante "só um corrente" não é expressável como índice no Prisma (exigiria
 * índice parcial), então mora aqui, como já acontece com "um VIGENTE por ano".
 */
export async function setCurrentYear(year: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.fiscalYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    await tx.fiscalYear.upsert({
      where: { year },
      create: { year, isCurrent: true },
      update: { isCurrent: true },
    });
  });
}

/**
 * Importação única de um exercício; sem `year`, a do exercício corrente.
 */
export async function getVigenteImportId(year?: number | null): Promise<string | null> {
  const targetYear = year ?? (await getCurrentYear());
  if (targetYear == null) return null;
  const row = await prisma.budgetImport.findUnique({
    where: { year: targetYear },
    select: { id: true },
  });
  return row?.id ?? null;
}

export type ExerciseInfo = {
  year: number;
  comparisonOnly: boolean;
  /** Exercício corrente: o único que recebe entregas das secretarias. */
  isCurrent: boolean;
  vigenteImportId: string;
};

/** Exercícios disponíveis: todo ano com uma base QDD, do mais recente ao mais antigo. */
export async function listExercises(): Promise<ExerciseInfo[]> {
  const [imports, policies, currentYear] = await Promise.all([
    prisma.budgetImport.findMany({
      orderBy: [{ year: 'desc' }, { importedAt: 'desc' }],
      select: { id: true, year: true },
    }),
    prisma.fiscalYear.findMany({ select: { year: true, comparisonOnly: true } }),
    getCurrentYear(),
  ]);
  const comparisonByYear = new Map(policies.map((p) => [p.year, p.comparisonOnly]));
  const byYear = new Map<number, ExerciseInfo>();
  for (const imp of imports) {
    if (byYear.has(imp.year)) continue; // já ordenado por importedAt desc
    byYear.set(imp.year, {
      year: imp.year,
      comparisonOnly: comparisonByYear.get(imp.year) ?? false,
      isCurrent: imp.year === currentYear,
      vigenteImportId: imp.id,
    });
  }
  return [...byYear.values()];
}

/**
 * Exercício apenas comparativo: recebe execução e marcações temáticas, mas **não**
 * gera ciclos de validação nem entregas. Ausência de linha em `FiscalYear`
 * significa exercício completo — por isso nada precisou ser semeado.
 */
export async function isComparisonOnlyYear(year: number): Promise<boolean> {
  const row = await prisma.fiscalYear.findUnique({
    where: { year },
    select: { comparisonOnly: true },
  });
  return row?.comparisonOnly ?? false;
}

/**
 * Resolve o exercício de uma requisição, aplicando o controle de acesso: só a
 * SEPLAN abre exercícios comparativos. Devolve `null` em `year` quando não há
 * nenhum QDD, e `forbidden: true` quando o usuário pediu um exercício vedado.
 */
export async function resolveExerciseYear(
  user: ScopedUser,
  requested?: number | null,
): Promise<{ year: number | null; forbidden: boolean }> {
  const current = await getCurrentYear();
  if (requested == null || requested === current) return { year: current, forbidden: false };

  const exercises = await listExercises();
  const target = exercises.find((e) => e.year === requested);
  if (!target) return { year: current, forbidden: false };
  if (target.comparisonOnly && user.role !== 'SEPLAN_ADMIN') {
    return { year: current, forbidden: true };
  }
  return { year: requested, forbidden: false };
}

// ── Scope (Órgão Executor) ───────────────────────────────────────────────────

export type ScopedUser = {
  role: string;
  organizationCode?: string | null;
  unitCode?: string | null;
};

/**
 * Retorna a lista de (organizationCode, unitCode) que o usuário pode acessar no
 * exercício indicado.
 * - SEPLAN_ADMIN: retorna `null` (sem restrição, vê tudo).
 * - Demais roles: consulta `ExerciseUnitExecutor` do exercício, cujo executor seja
 *   igual ao escopo do usuário (`executorOrgCode = user.organizationCode` e
 *   `executorUnitCode` igual a `user.unitCode` — ambos NULL = secretaria;
 *   ambos preenchidos = unidade autônoma).
 *   Sem `organizationCode` definido, retorna array vazio (nada acessível).
 *
 * O exercício importa porque a estrutura de governo muda entre anos: uma unidade
 * pode trocar de executor, nascer ou ser extinta.
 */
export async function getAllowedUnits(
  user: ScopedUser,
  year?: number | null,
): Promise<Array<{ organizationCode: string; unitCode: string }> | null> {
  if (user.role === 'SEPLAN_ADMIN') return null;
  if (!user.organizationCode) return [];
  const targetYear = year ?? (await getCurrentYear());
  if (targetYear == null) return [];
  const rows = await prisma.exerciseUnitExecutor.findMany({
    where: {
      year: targetYear,
      executorOrgCode: user.organizationCode,
      executorUnitCode: user.unitCode ?? null,
    },
    select: { organizationCode: true, unitCode: true },
  });
  return rows;
}

/**
 * Constrói o fragmento Prisma `where` a partir de uma lista de unidades já
 * resolvida por `getAllowedUnits` (evita re-consultar o escopo no mesmo request).
 */
export function scopeWhereFromAllowed(
  allowed: Array<{ organizationCode: string; unitCode: string }> | null,
): Record<string, unknown> {
  if (allowed === null) return {};
  if (allowed.length === 0) {
    // Força match vazio: nenhum registro tem organizationCode === ''
    return { organizationCode: '__NONE__' };
  }
  return {
    OR: allowed.map((u) => ({ organizationCode: u.organizationCode, unitCode: u.unitCode })),
  };
}

/** Point-check de controle de unidade sobre uma lista de unidades já resolvida. */
export function controlsUnitFromAllowed(
  allowed: Array<{ organizationCode: string; unitCode: string }> | null,
  organizationCode: string,
  unitCode: string,
): boolean {
  if (!allowed) return true;
  return allowed.some((u) => u.organizationCode === organizationCode && u.unitCode === unitCode);
}

/**
 * Devolve um fragmento Prisma `where` que restringe `organizationCode`+`unitCode`
 * ao escopo do usuário. Para SEPLAN_ADMIN retorna `{}` (sem restrição).
 */
export async function scopeWhere(user: ScopedUser, year?: number | null): Promise<Record<string, unknown>> {
  return scopeWhereFromAllowed(await getAllowedUnits(user, year));
}

/**
 * Verifica se o usuário controla a unidade indicada (point-check usado para
 * autorização em mutations sobre um único registro).
 */
export async function userControlsUnit(
  user: ScopedUser,
  organizationCode: string,
  unitCode: string,
  year?: number | null,
): Promise<boolean> {
  if (user.role === 'SEPLAN_ADMIN') return true;
  return controlsUnitFromAllowed(await getAllowedUnits(user, year), organizationCode, unitCode);
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Campos de ExpenseLine efetivamente serializados por `mapAction` — usar como
 * `select` evita trafegar colunas não usadas (ex.: `actionId`) do banco em
 * consultas que retornam milhares de linhas.
 */
const expenseLineSelect = {
  id: true, organizationCode: true, organizationName: true,
  unitCode: true, unitName: true, application: true,
  functionalProgram: true, projectActivity: true,
  expenseAccount: true, expenseDescription: true,
  reduced: true, source: true, initialBudget: true,
  supplemented: true, updatedBudget: true, committed: true,
  liquidated: true, payableToLiquidate: true,
  paid: true, payable: true, available: true,
} as const;

export async function listActions(user: ScopedUser, filters: {
  year?: number;
  organizationCode?: string;
  unitCode?: string;
}) {
  // `year` SELECIONA o import do exercício — não é um filtro aplicado dentro dele.
  const vigenteId = await getVigenteImportId(filters.year);
  if (!vigenteId) return [];

  const scope = await scopeWhere(user, filters.year);
  const where: Record<string, unknown> = {
    importId: vigenteId,
    presentInCurrentQdd: true,
    ...scope,
  };

  if (user.role === 'SEPLAN_ADMIN') {
    if (filters.organizationCode) where['organizationCode'] = filters.organizationCode;
    if (filters.unitCode) where['unitCode'] = filters.unitCode;
  }

  const rows = await prisma.budgetAction.findMany({
    where,
    include: { expenseLines: { select: expenseLineSelect }, assignments: true },
    orderBy: [{ organizationCode: 'asc' }, { unitCode: 'asc' }, { projectActivity: 'asc' }],
  });
  return rows.map(mapAction);
}

// ── Organizations ────────────────────────────────────────────────────────────

export async function listOrganizations(year?: number | null) {
  const structure = await listGovernmentStructure(year);
  return structure.organizations
    .map((org) => ({
      id: org.code,
      code: org.code,
      name: org.name,
      units: org.units.map((unit) => ({
        id: `${org.code}-${unit.code}`,
        code: unit.code,
        name: unit.name,
        organizationCode: org.code,
      })),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ── Summary ──────────────────────────────────────────────────────────────────

export async function getSummary(user: ScopedUser, year?: number | null) {
  // Resolve escopo e import vigente uma única vez e busca apenas os campos que a
  // agregação usa — evita materializar o grafo completo (expenseLines etc.).
  const targetYear = year ?? (await getCurrentYear());
  const [vigenteId, allowed] = await Promise.all([
    getVigenteImportId(targetYear),
    getAllowedUnits(user, targetYear),
  ]);
  const scope = scopeWhereFromAllowed(allowed);
  // Ciclos e validações também são por exercício: sem este recorte, o resumo de um
  // ano exibiria as contagens somadas de todos eles.
  const yearScope = {
    action: {
      presentInCurrentQdd: true,
      ...(targetYear == null ? {} : { year: targetYear }),
    },
  };

  const [actions, assignments, cycleCount, validations] = await Promise.all([
    vigenteId
      ? prisma.budgetAction.findMany({
          where: { importId: vigenteId, presentInCurrentQdd: true, ...scope },
          select: { id: true, liquidated: true },
        })
      : Promise.resolve([] as Array<{ id: string; liquidated: number }>),
    prisma.thematicAssignment.findMany({
      where: yearScope,
      select: { id: true, actionId: true, theme: true, classification: true, weightingFactor: true, createdAt: true },
    }),
    prisma.validationCycle.count({ where: targetYear == null ? {} : { year: targetYear } }),
    prisma.actionValidation.findMany({
      where: { ...scope, ...yearScope },
      select: { status: true, theme: true, assignmentId: true, deliveries: true },
    }),
  ]);

  const actionIds = new Set(actions.map((a) => a.id));
  const userAssignments = uniqueAssignmentsByActionTheme(assignments.filter((a) => actionIds.has(a.actionId)));

  const themes = ['OCAD', 'OSG', 'CLIMATICO'];
  const statuses = ['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'];

  const liquidatedByAction = new Map(actions.map((a) => [a.id, a.liquidated]));

  // Valor executado validado nas entregas (categorias por entrega) por assignment.
  const classificationByAssignment = new Map(userAssignments.map((a) => [a.id, a.classification ?? '']));
  const executedByAssignment = buildVerifiedDeliveryExecutedMap(
    validations.map((v) => ({
      assignmentId: v.assignmentId,
      theme: v.theme,
      status: v.status,
      deliveries: Array.isArray(v.deliveries)
        ? (v.deliveries as Array<{ executedValue?: number | null | unknown }>)
        : [],
      classification: classificationByAssignment.get(v.assignmentId) ?? '',
    })),
  );
  const validationCountByStatus = new Map<string, number>();
  for (const v of validations) {
    validationCountByStatus.set(v.status, (validationCountByStatus.get(v.status) ?? 0) + 1);
  }

  return {
    actions: actions.length,
    assignments: userAssignments.length,
    cycles: cycleCount,
    validations: validations.length,
    totalsByTheme: themes.map((theme) => {
      const themeAssignments = userAssignments.filter((a) => a.theme === theme);
      const seen = new Set<string>();
      let liquidated = 0;
      for (const a of themeAssignments) {
        if (seen.has(a.actionId)) continue;
        seen.add(a.actionId);
        liquidated += thematicBudgetContribution({
          theme: a.theme,
          classification: a.classification ?? '',
          weightingFactor: a.weightingFactor,
          initialBudget: 0,
          liquidated: liquidatedByAction.get(a.actionId) ?? 0,
          deliveryExecutedValue: executedByAssignment.get(a.id),
        }).liquidated;
      }
      return { theme, actions: seen.size, liquidated };
    }),
    totalsByClassification: (() => {
      const groups = new Map<string, { theme: string; classification: string; actionIds: Set<string>; liquidated: number }>();
      for (const a of userAssignments) {
        const classification = a.classification ?? '';
        if (!classification) continue;
        const key = `${a.theme}|${classification}`;
        const group = groups.get(key) ?? { theme: a.theme, classification, actionIds: new Set<string>(), liquidated: 0 };
        if (!group.actionIds.has(a.actionId)) {
          group.actionIds.add(a.actionId);
          group.liquidated += thematicBudgetContribution({
            theme: a.theme,
            classification,
            weightingFactor: a.weightingFactor,
            initialBudget: 0,
            liquidated: liquidatedByAction.get(a.actionId) ?? 0,
            deliveryExecutedValue: executedByAssignment.get(a.id),
          }).liquidated;
        }
        groups.set(key, group);
      }
      return [...groups.values()].map((group) => ({
        theme: group.theme,
        classification: group.classification,
        actions: group.actionIds.size,
        liquidated: group.liquidated,
      }));
    })(),
    validationsByStatus: statuses.map((status) => ({
      status,
      count: validationCountByStatus.get(status) ?? 0,
    })),
  };
}

// ── Validations ──────────────────────────────────────────────────────────────

/**
 * Classificações anteriores ao ciclo implícito podem não possuir a validação
 * correspondente. Reconcilia apenas esses registros ausentes para que a visão
 * administrativa contemple todos os orçamentos temáticos.
 *
 * Escopo por exercício é OBRIGATÓRIO aqui: sem ele, esta função recriaria as
 * entregas de um exercício apenas comparativo na primeira listagem da SEPLAN,
 * desfazendo em produção a supressão feita na classificação.
 */
async function ensureMissingAssignmentValidations(year: number | null) {
  if (year == null) return;
  if (await isComparisonOnlyYear(year)) return;

  const missingAssignments = await prisma.thematicAssignment.findMany({
    where: {
      validations: { none: {} },
      action: { year, presentInCurrentQdd: true },
    },
    select: {
      id: true,
      actionId: true,
      theme: true,
      action: {
        select: {
          year: true,
          organizationCode: true,
          unitCode: true,
        },
      },
    },
  });
  if (missingAssignments.length === 0) return;

  const cycleIds = new Map<string, string>();
  const validationsToCreate = [];
  for (const assignment of missingAssignments) {
    const cycleKey = `${assignment.theme}|${assignment.action.year}`;
    let cycleId = cycleIds.get(cycleKey);
    if (!cycleId) {
      cycleId = (await getOrCreateImplicitCycle(assignment.theme, assignment.action.year)).id;
      cycleIds.set(cycleKey, cycleId);
    }

    validationsToCreate.push({
      cycleId,
      actionId: assignment.actionId,
      assignmentId: assignment.id,
      organizationCode: assignment.action.organizationCode,
      unitCode: assignment.action.unitCode,
      theme: assignment.theme,
      status: 'RASCUNHO' as const,
      deliveries: [],
      evidences: [],
    });
  }

  if (validationsToCreate.length > 0) {
    await prisma.actionValidation.createMany({ data: validationsToCreate });
  }
}

export async function listValidations(user: ScopedUser, year?: number | null) {
  const targetYear = year ?? (await getCurrentYear());
  if (user.role === 'SEPLAN_ADMIN') {
    await ensureMissingAssignmentValidations(targetYear);
  }
  const scope = await scopeWhere(user, targetYear);
  const where: Record<string, unknown> = {
    ...scope,
    action: {
      presentInCurrentQdd: true,
      ...(targetYear == null ? {} : { year: targetYear }),
    },
  };
  const rows = await prisma.actionValidation.findMany({
    where,
    include: {
      action: { include: { expenseLines: { select: expenseLineSelect }, assignments: true } },
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
    presentInCurrentQdd: row.presentInCurrentQdd ?? true,
    inactiveAt: row.inactiveAt instanceof Date ? row.inactiveAt.toISOString() : (row.inactiveAt ?? null),
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
    action: row.action ? mapAction(row.action) : undefined,
    assignment: row.assignment ? mapAssignment(row.assignment) : undefined,
    cycle: row.cycle ? mapCycle(row.cycle) : undefined,
  };
}

// ── Executor reconciliation ──────────────────────────────────────────────────

/**
 * Após uma importação de QDD, garante que existe um `ExerciseUnitExecutor` default
 * para cada par (organizationCode, unitCode) do exercício. O default é "secretaria
 * pai executa" (`executorOrgCode = organizationCode`, `executorUnitCode = NULL`).
 * Mapeamentos já configurados (ex.: FEM controlando o Fundo Estadual de Cultura)
 * são PRESERVADOS.
 *
 * A união com os pares das ações importadas cobre unidades que ainda não entraram
 * no cadastro do exercício — `ExerciseUnitExecutor` não tem FK para `ExerciseUnit`
 * justamente para permitir isso.
 */
export async function reconcileExecutorsForImport(
  year: number,
  actions: Array<{ organizationCode: string; unitCode: string }> = [],
): Promise<void> {
  const units = await prisma.exerciseUnit.findMany({
    where: { year, active: true },
    select: { organizationCode: true, code: true },
  });

  const pairs = new Map<string, { organizationCode: string; unitCode: string }>();
  for (const row of units) {
    pairs.set(`${row.organizationCode}|${row.code}`, {
      organizationCode: row.organizationCode,
      unitCode: row.code,
    });
  }
  for (const action of actions) {
    if (!action?.organizationCode || !action?.unitCode) continue;
    pairs.set(`${action.organizationCode}|${action.unitCode}`, {
      organizationCode: action.organizationCode,
      unitCode: action.unitCode,
    });
  }
  if (pairs.size === 0) return;

  // `skipDuplicates` sobre a PK (year, organizationCode, unitCode) equivale ao
  // upsert com `update: {}`: cria o default se não existe e preserva o que já existe.
  await prisma.exerciseUnitExecutor.createMany({
    data: [...pairs.values()].map((row) => ({
      year,
      organizationCode: row.organizationCode,
      unitCode: row.unitCode,
      executorOrgCode: row.organizationCode,
      executorUnitCode: null,
    })),
    skipDuplicates: true,
  });
}

// ── QDD único por exercício ─────────────────────────────────────────────────

/** Forma serializável de uma ação cuja marcação não pôde ser religada. */
export type OrphanAction = {
  organizationCode: string; organizationName: string;
  unitCode: string; unitName: string; projectActivity: string; application: string;
};

export type BudgetReplacementResult = {
  importId: string;
  createdActions: number;
  updatedActions: number;
  inactivatedActions: number;
  reactivatedActions: number;
  deletedActions: number;
  preservedAssignments: number;
  inactiveActions: OrphanAction[];
};

export class FiscalYearPolicyConflictError extends Error {}

export async function deleteBudgetImportIfUncurated(importId: string) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.budgetImport.findUnique({ where: { id: importId } });
    if (!target) return { target: null, assignments: 0, validations: 0 };

    const [assignments, validations] = await Promise.all([
      tx.thematicAssignment.count({ where: { action: { importId } } }),
      tx.actionValidation.count({ where: { action: { importId } } }),
    ]);
    if (assignments > 0 || validations > 0) return { target, assignments, validations };

    await tx.validationCycle.deleteMany({ where: { year: target.year } });
    await tx.exerciseUnitExecutor.deleteMany({ where: { year: target.year } });
    await tx.exerciseOrganization.deleteMany({ where: { year: target.year } });
    await tx.fiscalYear.deleteMany({ where: { year: target.year } });
    await tx.budgetImport.delete({ where: { id: importId } });
    return { target, assignments: 0, validations: 0 };
  }, {
    maxWait: 10000,
    timeout: 60000,
  });
}

function actionWriteData(action: any) {
  return {
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
    presentInCurrentQdd: true,
    inactiveAt: null,
  };
}

function expenseLineWriteData(line: any, actionId: string) {
  return {
    id: line.id,
    actionId,
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
  };
}

async function updateActionsInBatches(tx: any, rows: Array<{ id: string; action: any }>, batchSize = 500) {
  const sql = `
    UPDATE "BudgetAction" AS target
    SET "year" = incoming."year",
        "organizationCode" = incoming."organizationCode",
        "organizationName" = incoming."organizationName",
        "unitCode" = incoming."unitCode",
        "unitName" = incoming."unitName",
        "application" = incoming."application",
        "functionalProgram" = incoming."functionalProgram",
        "projectActivity" = incoming."projectActivity",
        "initialBudget" = incoming."initialBudget",
        "supplemented" = incoming."supplemented",
        "updatedBudget" = incoming."updatedBudget",
        "committed" = incoming."committed",
        "liquidated" = incoming."liquidated",
        "paid" = incoming."paid",
        "available" = incoming."available",
        "presentInCurrentQdd" = TRUE,
        "inactiveAt" = NULL
    FROM jsonb_to_recordset($1::jsonb) AS incoming(
      "id" text, "year" integer, "organizationCode" text, "organizationName" text,
      "unitCode" text, "unitName" text, "application" text,
      "functionalProgram" text, "projectActivity" text,
      "initialBudget" double precision, "supplemented" double precision,
      "updatedBudget" double precision, "committed" double precision,
      "liquidated" double precision, "paid" double precision, "available" double precision
    )
    WHERE target."id" = incoming."id"
  `;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize).map(({ id, action }) => ({
      id,
      ...actionWriteData(action),
    }));
    if (batch.length) await tx.$executeRawUnsafe(sql, JSON.stringify(batch));
  }
}

export async function replaceImportedBudget(
  importRecord: any,
  actions: any[],
  audit: { updatedBy: string; source: 'MANUAL' | 'SICAF'; confirmationKey: string },
  comparisonOnly: boolean,
): Promise<BudgetReplacementResult> {
  return prisma.$transaction(async (tx) => {
    // Uma única confirmação por exercício pode modificar a base por vez.
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)::text AS lock_result',
      20260828,
      Number(importRecord.year),
    );

    const existingPolicy = await tx.fiscalYear.findUnique({
      where: { year: importRecord.year },
      select: { comparisonOnly: true },
    });
    if (existingPolicy && existingPolicy.comparisonOnly !== comparisonOnly) {
      throw new FiscalYearPolicyConflictError(
        existingPolicy.comparisonOnly
          ? `O exercício ${importRecord.year} já está registrado como apenas comparativo.`
          : `O exercício ${importRecord.year} já está registrado como exercício completo.`,
      );
    }

    const alreadyConfirmed = await tx.budgetImportRevision.findUnique({
      where: { confirmationKey: audit.confirmationKey },
      select: { importId: true },
    });
    if (alreadyConfirmed) {
      return {
        importId: alreadyConfirmed.importId,
        createdActions: 0,
        updatedActions: 0,
        inactivatedActions: 0,
        reactivatedActions: 0,
        deletedActions: 0,
        preservedAssignments: 0,
        inactiveActions: [],
      };
    }

    const currentImport = await tx.budgetImport.findUnique({
      where: { year: importRecord.year },
      select: { id: true },
    });
    const existing = currentImport
      ? await tx.budgetAction.findMany({
          where: { importId: currentImport.id },
          select: {
            id: true,
            year: true,
            organizationCode: true,
            organizationName: true,
            unitCode: true,
            unitName: true,
            projectActivity: true,
            application: true,
            presentInCurrentQdd: true,
            _count: { select: { assignments: true, validations: true } },
          },
        })
      : [];

    const plan = planQddReplacement(
      existing.map((action: any) => ({
        ...action,
        hasAssignments: action._count.assignments > 0,
        hasValidations: action._count.validations > 0,
      })),
      actions,
    );

    const base = await tx.budgetImport.upsert({
      where: { year: importRecord.year },
      create: {
        id: importRecord.id,
        filename: importRecord.filename,
        year: importRecord.year,
        referenceMonth: importRecord.referenceMonth,
        periodType: importRecord.periodType,
        importedAt: new Date(importRecord.importedAt),
        rowCount: importRecord.rowCount,
        actionCount: importRecord.actionCount,
        status: 'VIGENTE',
      },
      update: {
        filename: importRecord.filename,
        referenceMonth: importRecord.referenceMonth,
        periodType: importRecord.periodType,
        importedAt: new Date(importRecord.importedAt),
        rowCount: importRecord.rowCount,
        actionCount: importRecord.actionCount,
        status: 'VIGENTE',
      },
      select: { id: true },
    });

    await tx.fiscalYear.upsert({
      where: { year: importRecord.year },
      create: { year: importRecord.year, comparisonOnly },
      update: {},
    });

    const incomingIdByIndex = new Map<number, string>();
    for (const match of plan.matches) incomingIdByIndex.set(match.incomingIndex, match.existingId);
    for (const index of plan.createIndexes) incomingIdByIndex.set(index, actions[index].id);

    const matchedRows = plan.matches.map((match) => ({
      id: match.existingId,
      action: actions[match.incomingIndex],
    }));
    await updateActionsInBatches(tx, matchedRows);

    await createInBatches(tx.budgetAction, plan.createIndexes.map((index) => ({
      id: actions[index].id,
      importId: base.id,
      ...actionWriteData(actions[index]),
    })));

    if (plan.matches.length) {
      await tx.expenseLine.deleteMany({
        where: { actionId: { in: plan.matches.map((match) => match.existingId) } },
      });
    }

    const lines = actions.flatMap((action, index) => {
      const actionId = incomingIdByIndex.get(index);
      if (!actionId) throw new Error('Falha ao resolver a ação da linha importada.');
      return action.expenseLines.map((line: any) => expenseLineWriteData(line, actionId));
    });
    await createInBatches(tx.expenseLine, lines);

    const inactiveAt = new Date();
    if (plan.inactivateIds.length) {
      await tx.budgetAction.updateMany({
        where: { id: { in: plan.inactivateIds } },
        data: { presentInCurrentQdd: false, inactiveAt },
      });
    }
    if (plan.deleteIds.length) {
      await tx.budgetAction.deleteMany({ where: { id: { in: plan.deleteIds } } });
    }

    await tx.budgetImportRevision.create({
      data: {
        importId: base.id,
        year: importRecord.year,
        filename: importRecord.filename,
        referenceMonth: importRecord.referenceMonth,
        periodType: importRecord.periodType,
        rowCount: importRecord.rowCount,
        actionCount: importRecord.actionCount,
        source: audit.source,
        updatedBy: audit.updatedBy,
        confirmationKey: audit.confirmationKey,
        createdAt: new Date(importRecord.importedAt),
      },
    });

    const inactiveRows = existing.filter((action: any) => plan.inactivateIds.includes(action.id));
    const preservedAssignments = existing.reduce(
      (total: number, action: any) => total + action._count.assignments,
      0,
    );

    return {
      importId: base.id,
      createdActions: plan.createIndexes.length,
      updatedActions: plan.matches.length,
      inactivatedActions: plan.inactivateIds.length,
      reactivatedActions: plan.matches.filter((match) => match.reactivated).length,
      deletedActions: plan.deleteIds.length,
      preservedAssignments,
      inactiveActions: inactiveRows.map((action: any) => ({
        organizationCode: action.organizationCode,
        organizationName: action.organizationName,
        unitCode: action.unitCode,
        unitName: action.unitName,
        projectActivity: action.projectActivity,
        application: action.application,
      })),
    };
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
