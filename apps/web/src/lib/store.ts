/**
 * Shared data-access helpers used by Next.js API Route Handlers.
 */
import 'server-only';

import { randomUUID } from 'node:crypto';
import { listGovernmentStructure } from './government-structure';
import { actionLogicalKey } from './qdd-parser';
import { prisma } from './prisma';
import { buildVerifiedDeliveryExecutedMap, thematicBudgetContribution } from './classification-rules';

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
    where: { status: 'VIGENTE' },
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
 * Import vigente de um exercício; sem `year`, o do exercício corrente.
 *
 * A invariante é **um VIGENTE por ano** (antes era um único global). O `orderBy`
 * mantém a escolha determinística: sem ele, o `findFirst` poderia devolver imports
 * diferentes entre chamadas caso a invariante seja violada — o que faria uma
 * leitura eventual voltar ações/marcações vazias e "apagar" a tela até um F5.
 */
export async function getVigenteImportId(year?: number | null): Promise<string | null> {
  const targetYear = year ?? (await getCurrentYear());
  if (targetYear == null) return null;
  const rows = await prisma.budgetImport.findMany({
    where: { status: 'VIGENTE', year: targetYear },
    orderBy: { importedAt: 'desc' },
    select: { id: true },
  });
  if (rows.length > 1) {
    console.warn(
      `[getVigenteImportId] Invariante violada: ${rows.length} imports VIGENTE simultâneos ` +
        `no exercício ${targetYear} (${rows.map((r) => r.id).join(', ')}). Usando o mais recente.`,
    );
  }
  return rows[0]?.id ?? null;
}

export type ExerciseInfo = {
  year: number;
  comparisonOnly: boolean;
  /** Exercício corrente: o único que recebe entregas das secretarias. */
  isCurrent: boolean;
  vigenteImportId: string;
};

/** Exercícios disponíveis: todo ano com QDD VIGENTE, do mais recente ao mais antigo. */
export async function listExercises(): Promise<ExerciseInfo[]> {
  const [imports, policies, currentYear] = await Promise.all([
    prisma.budgetImport.findMany({
      where: { status: 'VIGENTE' },
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
  const where: Record<string, unknown> = { importId: vigenteId, ...scope };

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
  const yearScope = targetYear == null ? {} : { action: { year: targetYear } };

  const [actions, assignments, cycleCount, validations] = await Promise.all([
    vigenteId
      ? prisma.budgetAction.findMany({
          where: { importId: vigenteId, ...scope },
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
    where: { validations: { none: {} }, action: { year } },
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
    ...(targetYear == null ? {} : { action: { year: targetYear } }),
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

// ── addImportedBudget ────────────────────────────────────────────────────────

/** Forma serializável de uma ação cuja marcação não pôde ser religada. */
export type OrphanAction = {
  organizationCode: string; organizationName: string;
  unitCode: string; unitName: string; projectActivity: string; application: string;
};

/** Campos mínimos de uma ação para calcular a chave lógica e religar marcações. */
type ActionKeyInfo = OrphanAction & { id: string; year: number };

/**
 * Re-aponta `ThematicAssignment` (e o `ActionValidation` correspondente) das
 * `oldActions` para a ação equivalente do import vigente, casando pela chave
 * lógica. Retorna quantas marcações foram religadas e quais ações antigas não
 * encontraram correspondente (marcação preservada, mas órfã).
 */
async function remapAssignments(
  tx: any,
  oldActions: ActionKeyInfo[],
  newIdByKey: Map<string, string>,
): Promise<{ reattached: number; unmatched: OrphanAction[] }> {
  let reattached = 0;
  const unmatched: OrphanAction[] = [];
  for (const old of oldActions) {
    const newId = newIdByKey.get(actionLogicalKey(old));
    if (!newId) {
      const { id: _id, year: _year, ...rest } = old;
      unmatched.push(rest);
      continue;
    }
    if (newId === old.id) continue;
    const res = await tx.thematicAssignment.updateMany({ where: { actionId: old.id }, data: { actionId: newId } });
    await tx.actionValidation.updateMany({ where: { actionId: old.id }, data: { actionId: newId } });
    reattached += res.count;
  }
  return { reattached, unmatched };
}

function findUnmatchedActions(
  oldActions: ActionKeyInfo[],
  newIdByKey: Map<string, string>,
): OrphanAction[] {
  return oldActions.flatMap((old) => {
    if (newIdByKey.has(actionLogicalKey(old))) return [];
    const { id: _id, year: _year, ...rest } = old;
    return [rest];
  });
}

/**
 * Deletes a QDD while preserving its thematic assignments. Markers are moved to
 * the equivalent action in another QDD before deletion. If even one marker has
 * no equivalent action, the transaction makes no changes and cancels deletion.
 */
export async function deleteBudgetImportPreservingAssignments(importId: string) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.budgetImport.findUnique({ where: { id: importId } });
    if (!target) return { target: null, reattached: 0, unmatched: [] as OrphanAction[] };

    const markedActions: ActionKeyInfo[] = await tx.budgetAction.findMany({
      where: { importId, assignments: { some: {} } },
      select: {
        id: true, year: true, organizationCode: true, organizationName: true,
        unitCode: true, unitName: true, projectActivity: true, application: true,
      },
    });

    // For a historical import, prefer the current QDD. When the current QDD is
    // deleted, this picks the newest historical QDD, which is promoted below.
    const survivingActions = await tx.budgetAction.findMany({
      where: { importId: { not: importId }, year: target.year },
      select: {
        id: true, year: true, organizationCode: true, unitCode: true,
        projectActivity: true, application: true,
        import: { select: { status: true, importedAt: true } },
      },
    });
    const preferredActionByKey = new Map<string, (typeof survivingActions)[number]>();
    for (const action of survivingActions) {
      const key = actionLogicalKey(action);
      const current = preferredActionByKey.get(key);
      if (
        !current ||
        (action.import.status === 'VIGENTE' && current.import.status !== 'VIGENTE') ||
        (action.import.status === current.import.status && action.import.importedAt > current.import.importedAt)
      ) {
        preferredActionByKey.set(key, action);
      }
    }
    const replacementIdByKey = new Map(
      [...preferredActionByKey].map(([key, action]) => [key, action.id]),
    );

    const unmatched = findUnmatchedActions(markedActions, replacementIdByKey);
    if (unmatched.length > 0) {
      return { target, reattached: 0, unmatched };
    }

    const { reattached } = await remapAssignments(tx, markedActions, replacementIdByKey);

    // Validations that follow a marker were moved by remapAssignments. Any
    // remaining validation belongs to data that is intentionally being deleted.
    await tx.actionValidation.deleteMany({
      where: { action: { importId } },
    });
    await tx.budgetImport.delete({ where: { id: importId } });

    // A promoção é DENTRO DO MESMO EXERCÍCIO. Sem o recorte por ano, apagar o
    // único VIGENTE de um exercício encontraria o VIGENTE de outro ano, o ramo
    // abaixo não rodaria e o exercício ficaria sem nenhum vigente — sumindo por
    // inteiro da aplicação.
    const vigente = await tx.budgetImport.findFirst({
      where: { status: 'VIGENTE', year: target.year },
      orderBy: { importedAt: 'desc' },
      select: { id: true },
    });

    if (!vigente) {
      const nextImport = await tx.budgetImport.findFirst({
        where: { year: target.year },
        orderBy: { importedAt: 'desc' },
      });

      if (nextImport) {
        await tx.budgetImport.update({
          where: { id: nextImport.id },
          data: { status: 'VIGENTE' },
        });
      }
    }

    return { target, reattached, unmatched };
  }, {
    maxWait: 10000,
    timeout: 60000,
  });
}

export async function addImportedBudget(importRecord: any, actions: any[]): Promise<{ reattached: number; unmatched: OrphanAction[] }> {
  return prisma.$transaction(async (tx) => {
    // Captura as ações DO MESMO EXERCÍCIO que ainda têm marcações, para religá-las
    // às novas ações (que receberão IDs novos). As ações recém-criadas deste import
    // ainda não têm marcações, então isso cobre tanto o vigente anterior quanto
    // eventuais marcações já órfãs de imports históricos — tornando a preservação
    // automática no confirm, sem ação manual.
    //
    // O recorte por ano é essencial: `actionLogicalKey` começa pelo exercício, então
    // marcações de outro ano nunca casariam e seriam reportadas como órfãs, fazendo
    // a tela de importação anunciar uma perda que não aconteceu.
    const oldMarkedActions: ActionKeyInfo[] = await tx.budgetAction.findMany({
      where: { year: importRecord.year, assignments: { some: {} } },
      select: {
        id: true, year: true, organizationCode: true, organizationName: true,
        unitCode: true, unitName: true, projectActivity: true, application: true,
      },
    });

    // Rebaixa apenas o vigente DO MESMO EXERCÍCIO: os demais exercícios seguem
    // intactos, cada um com o seu próprio vigente.
    await tx.budgetImport.updateMany({
      where: { status: 'VIGENTE', year: importRecord.year },
      data: { status: 'HISTORICO' },
    });
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

    // Religa as marcações das ações aposentadas às novas ações equivalentes.
    const newIdByKey = new Map<string, string>(
      actions.map((action) => [actionLogicalKey(action), action.id] as const),
    );
    return remapAssignments(tx, oldMarkedActions, newIdByKey);
  }, {
    maxWait: 10000,
    timeout: 60000,
  });
}

/**
 * Religa ao QDD vigente do exercício as marcações que ficaram órfãs em importações
 * anteriores (presas a ações HISTORICO). Idempotente.
 *
 * Opera dentro de um único exercício: como `actionLogicalKey` começa pelo ano, uma
 * marcação de outro exercício jamais casaria — varrer os demais só produziria ruído.
 */
export async function reattachOrphanAssignmentsToVigente(
  year?: number | null,
): Promise<{ reattached: number; unmatched: OrphanAction[] }> {
  const targetYear = year ?? (await getCurrentYear());
  if (targetYear == null) return { reattached: 0, unmatched: [] };
  const vigenteId = await getVigenteImportId(targetYear);
  if (!vigenteId) return { reattached: 0, unmatched: [] };

  return prisma.$transaction(async (tx) => {
    const vigenteActions = await tx.budgetAction.findMany({
      where: { importId: vigenteId },
      select: { id: true, year: true, organizationCode: true, unitCode: true, projectActivity: true, application: true },
    });
    const newIdByKey = new Map<string, string>(
      vigenteActions.map((a: any) => [actionLogicalKey(a), a.id] as const),
    );

    const orphanActions: ActionKeyInfo[] = await tx.budgetAction.findMany({
      where: { importId: { not: vigenteId }, year: targetYear, assignments: { some: {} } },
      select: {
        id: true, year: true, organizationCode: true, organizationName: true,
        unitCode: true, unitName: true, projectActivity: true, application: true,
      },
    });

    return remapAssignments(tx, orphanActions, newIdByKey);
  }, { maxWait: 10000, timeout: 60000 });
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
