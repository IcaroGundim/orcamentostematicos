/**
 * Agregações do monitoramento da execução orçamentária (`/orcamento`).
 *
 * Funções puras sobre as ações do QDD vigente, sem I/O — a rota carrega as ações
 * uma vez por `GET /api/budget-actions` e agrega aqui.
 *
 * **Nível de cada eixo:** elemento de despesa e fonte de recurso só existem em
 * `ExpenseLine`, então essas agregações percorrem `action.expenseLines`. Já ação
 * orçamentária e emenda são atributos da ação e usam `action.totals`.
 */

import { cleanExpenseDescription } from './expense-breakdown';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_GROUPS,
  EXPENSE_MODALITIES,
  expenseElementName,
  parseExpenseAccount,
} from './expense-nature';
import { actionIsAmendment } from './functional-classification';
import { getFonteLabel } from './fontes-recursos';
import { organizationAcronym } from './organization-acronym';
import type { BudgetAction, ExpenseLine } from '@/types/domain';

export const CENTRAL_PAYROLL_ORGANIZATION = '714';
export const CENTRAL_PAYROLL_UNIT = '002';
export const HEALTH_PAYROLL_UNIT = '607';

type CentralPayrollScope = {
  organizationCode: string;
  unitCode: string;
} | null;

type CentralPayrollTarget = {
  organizationCode: string;
  unitCode?: string;
  name: string;
  acronym?: string;
};

/**
 * Destinos auditados das ações da folha centralizada.
 *
 * O código da ação é usado como chave porque nomes e vinculações administrativas
 * mudam ao longo do exercício e algumas unidades permanecem duplicadas no QDD após
 * uma realocação. `null` indica despesa que não integra o gasto de pessoal de uma
 * secretaria específica.
 */
const CENTRAL_PAYROLL_SCOPES: Record<string, CentralPayrollScope> = {
  '20260000': { organizationCode: '445', unitCode: '001' }, // SEGOV
  '20270000': { organizationCode: '713', unitCode: '001' }, // SEPLAN
  '20280000': { organizationCode: '714', unitCode: '001' }, // SEAD
  '20290000': { organizationCode: '711', unitCode: '001' }, // SECOM
  '20300000': { organizationCode: '711', unitCode: '308' }, // FUNDAC
  '20310000': { organizationCode: '450', unitCode: '001' }, // GABVICE
  '20320000': { organizationCode: '444', unitCode: '001' }, // REPAC
  '20330000': { organizationCode: '760', unitCode: '304' }, // FUNBESA
  '20340000': { organizationCode: '510', unitCode: '001' }, // PGE
  '20350000': { organizationCode: '720', unitCode: '206' }, // ITERACRE
  '20360000': { organizationCode: '753', unitCode: '207' }, // IDAF
  '20370000': { organizationCode: '719', unitCode: '209' }, // IAPEN
  '20380000': { organizationCode: '715', unitCode: '210' }, // AGEAC
  '20390000': { organizationCode: '753', unitCode: '001' }, // SEAGRI
  '20400000': { organizationCode: '754', unitCode: '001' }, // SEOP
  '20410000': { organizationCode: '719', unitCode: '001' }, // SEJUSP
  '20420000': { organizationCode: '447', unitCode: '001' }, // CASMIL
  '20430000': { organizationCode: '608', unitCode: '001' }, // PMAC
  '20440000': { organizationCode: '609', unitCode: '001' }, // CBMAC
  '20450000': { organizationCode: '720', unitCode: '001' }, // SEMA
  '20460000': { organizationCode: '761', unitCode: '301' }, // FUNTAC
  '20470000': { organizationCode: '720', unitCode: '202' }, // IMAC
  '20480000': { organizationCode: '720', unitCode: '215' }, // IMC
  '20490000': { organizationCode: '721', unitCode: '302' }, // FUNDHACRE
  '20500000': { organizationCode: '744', unitCode: '201' }, // DERACRE
  '20510000': { organizationCode: '759', unitCode: '001' }, // SETE
  '20520000': { organizationCode: '715', unitCode: '404' }, // COLONACRE
  '20530000': null, // Pensões especiais dos hansenianos: GND 3, não pessoal.
  '20540000': { organizationCode: '760', unitCode: '307' }, // FADES
  '20550000': { organizationCode: '715', unitCode: '502' }, // SANACRE
  '20560000': { organizationCode: '715', unitCode: '001' }, // SEFAZ
  '20570000': { organizationCode: '760', unitCode: '001' }, // SEASDH
  '20580000': { organizationCode: '762', unitCode: '001' }, // SEMULHER
  '20590000': { organizationCode: '761', unitCode: '309' }, // FAPAC
  '20600000': { organizationCode: '717', unitCode: '303' }, // FEM
  '20610000': { organizationCode: '446', unitCode: '001' }, // SECC
  '20620000': { organizationCode: '448', unitCode: '001' }, // CGE
  '20630000': { organizationCode: '714', unitCode: '306' }, // FDRHCD
  '20640000': { organizationCode: '719', unitCode: '213' }, // ISE
  '20650000': { organizationCode: '451', unitCode: '001' }, // PCAC
  '20660000': { organizationCode: '761', unitCode: '214' }, // IPEM
  '20670000': { organizationCode: '761', unitCode: '001' }, // SEICT
  '20680000': { organizationCode: '719', unitCode: '216' }, // PROCON
  '20690000': { organizationCode: '744', unitCode: '001' }, // SEHURB
  '20700000': { organizationCode: '721', unitCode: '607' }, // SESACRE / FUNDES
  '23070000': { organizationCode: '718', unitCode: '001' }, // SEEL
  '23080000': { organizationCode: '452', unitCode: '001' }, // CEPDEC
  '23090000': { organizationCode: '722', unitCode: '001' }, // SEPI
  '80000000': null, // Inativos e pensionistas: sem rateio por secretaria.
};

/**
 * Elementos de GND 3 que integram o custo da folha quando lançados em uma ação
 * nominal de folha de pagamento. A restrição pela ação evita classificar auxílios
 * e indenizações de políticas finalísticas como despesa de pessoal.
 */
const PAYROLL_RELATED_CURRENT_EXPENSE_ELEMENTS = new Set([
  '08', // Outros benefícios assistenciais do servidor ou militar
  '13', // Obrigações patronais
  '36', // Outros serviços de terceiros — pessoa física
  '46', // Auxílio-alimentação
  '47', // Obrigações tributárias e contributivas
  '48', // Outros auxílios financeiros a pessoas físicas
  '49', // Auxílio-transporte
  '92', // Despesas de exercícios anteriores
  '93', // Indenizações e restituições
  '94', // Indenizações e restituições trabalhistas
]);

export interface ExecutionTotals {
  initialBudget: number;
  updatedBudget: number;
  committed: number;
  liquidated: number;
  paid: number;
  available: number;
}

export interface ExecutionRow extends ExecutionTotals {
  /** Chave estável do agrupamento (código do elemento, id da ação, fonte…). */
  key: string;
  /** Rótulo já formatado para exibição. */
  label: string;
  /** Rótulo curto, para eixos de gráfico. */
  shortLabel: string;
  /** Rótulo do eixo quando ele não deve receber o prefixo automático da chave. */
  chartLabel?: string;
  /** Quantas linhas/ações compõem a linha agregada. */
  count: number;
  /** Liquidado ÷ dotação atualizada, em %. */
  executionRate: number;
}

const EMPTY: ExecutionTotals = {
  initialBudget: 0,
  updatedBudget: 0,
  committed: 0,
  liquidated: 0,
  paid: 0,
  available: 0,
};

/**
 * Estágio da despesa exibido nos gráficos. Toda `ExecutionRow` já carrega os cinco
 * valores, então trocar a ótica é escolher qual campo ler — as agregações não
 * precisam ser recalculadas.
 */
export type ExecutionMetric = 'initialBudget' | 'updatedBudget' | 'committed' | 'liquidated' | 'paid';

/** Ordem que segue o ciclo da despesa: dotação → empenho → liquidação → pagamento. */
export const EXECUTION_METRICS: ExecutionMetric[] = [
  'initialBudget',
  'updatedBudget',
  'committed',
  'liquidated',
  'paid',
];

export const EXECUTION_METRIC_LABELS: Record<ExecutionMetric, string> = {
  initialBudget: 'Dotação inicial',
  updatedBudget: 'Dotação atualizada',
  committed: 'Empenhado',
  liquidated: 'Liquidado',
  paid: 'Pago',
};

/**
 * Percentual de execução: liquidado sobre a **dotação atualizada**.
 *
 * Atenção: é uma base diferente da usada nos orçamentos temáticos, que medem
 * sobre a dotação **inicial** (ver `thematicBudgetContribution` em
 * `classification-rules.ts`). Aqui o acompanhamento é da execução real, então o
 * denominador correto é o orçamento vigente, já com suplementações.
 */
export function executionRate(liquidated: number, updatedBudget: number): number {
  if (!updatedBudget) return 0;
  return (liquidated / updatedBudget) * 100;
}

function addTotals(target: ExecutionTotals, source: Partial<ExecutionTotals>): void {
  target.initialBudget += source.initialBudget ?? 0;
  target.updatedBudget += source.updatedBudget ?? 0;
  target.committed += source.committed ?? 0;
  target.liquidated += source.liquidated ?? 0;
  target.paid += source.paid ?? 0;
  target.available += source.available ?? 0;
}

type Bucket = ExecutionTotals & {
  key: string;
  label: string;
  shortLabel: string;
  chartLabel?: string;
  count: number;
};

function bucketOf(
  map: Map<string, Bucket>,
  key: string,
  label: string,
  shortLabel: string,
  chartLabel?: string,
): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { key, label, shortLabel, chartLabel, count: 0, ...EMPTY };
    map.set(key, bucket);
  }
  return bucket;
}

/** Ordena do maior liquidado para o menor e calcula o percentual de execução. */
function finish(map: Map<string, Bucket>): ExecutionRow[] {
  return [...map.values()]
    .map((bucket) => ({ ...bucket, executionRate: executionRate(bucket.liquidated, bucket.updatedBudget) }))
    .sort((a, b) => b.liquidated - a.liquidated);
}

function linesOf(actions: BudgetAction[]): ExpenseLine[] {
  return actions.flatMap((action) => action.expenseLines ?? []);
}

function normalizedIdentity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Identifica ações executadas nas unidades centralizadas de folha da SEAD. */
export function isCentralPayrollAction(
  action: Pick<BudgetAction, 'organizationCode' | 'unitCode'>,
): boolean {
  const unitCode = action.unitCode.padStart(3, '0');
  return (
    action.organizationCode.padStart(3, '0') === CENTRAL_PAYROLL_ORGANIZATION &&
    (unitCode === CENTRAL_PAYROLL_UNIT || unitCode === HEALTH_PAYROLL_UNIT)
  );
}

/**
 * Localiza, nas unidades 714/002 e 714/607, as ações de folha que atendem os alvos.
 *
 * O QDD não possui uma coluna própria de órgão beneficiário, mas a aplicação programada
 * identifica nominalmente a secretaria, autarquia ou fundação e, normalmente, sua sigla.
 * O nome completo é a chave principal; a sigla, delimitada como palavra, é fallback.
 */
export function centralPayrollActionsForTargets(
  actions: BudgetAction[],
  targets: CentralPayrollTarget[],
): BudgetAction[] {
  const identities = targets.map((target) => {
    const name = normalizedIdentity(target.name);
    const inferredAcronym =
      target.acronym ??
      target.name.match(/(?:\s[-–—]\s*|\()([A-Z][A-Z0-9]{2,11})\)?\.?\s*$/)?.[1] ??
      '';
    const acronym = normalizedIdentity(inferredAcronym);
    return {
      organizationCode: target.organizationCode.padStart(3, '0'),
      unitCode: target.unitCode?.padStart(3, '0'),
      name,
      acronymPattern:
        acronym && !/^\d+$/.test(acronym)
          ? new RegExp(
              `(?:^|\\s)${acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`,
            )
          : null,
    };
  });

  return actions.filter((action) => {
    if (!isCentralPayrollAction(action)) return false;
    const application = normalizedIdentity(action.application);
    if (!application.includes('folha de pagamento')) return false;

    const projectActivity = action.projectActivity.trim();
    if (Object.prototype.hasOwnProperty.call(CENTRAL_PAYROLL_SCOPES, projectActivity)) {
      const scope = CENTRAL_PAYROLL_SCOPES[projectActivity];
      if (!scope) return false;
      return identities.some(
        (identity) =>
          identity.organizationCode === scope.organizationCode &&
          (!identity.unitCode || identity.unitCode === scope.unitCode),
      );
    }

    return identities.some(
      (identity) =>
        (identity.name.length >= 6 && application.includes(identity.name)) ||
        (identity.acronymPattern?.test(application) ?? false),
    );
  });
}

/** Soma geral — usada nos cartões de totais e para conferir se as visões fecham. */
export function totalsOf(actions: BudgetAction[]): ExecutionTotals {
  const totals = { ...EMPTY };
  for (const action of actions) addTotals(totals, action.totals);
  return totals;
}

/**
 * Soma o custo ampliado de pessoal:
 * - todas as linhas de GND 1; e
 * - auxílios, benefícios e verbas indenizatórias de GND 3 quando pertencem a uma
 *   ação explicitamente identificada como folha de pagamento.
 */
export function personnelTotalsOf(actions: BudgetAction[]): ExecutionTotals {
  const totals = { ...EMPTY };
  for (const action of actions) {
    const isPayrollApplication = normalizedIdentity(action.application).includes(
      'folha de pagamento',
    );
    for (const line of action.expenseLines ?? []) {
      const nature = parseExpenseAccount(line.expenseAccount);
      if (!nature) continue;
      const isPersonnelGroup = nature.groupCode === '1';
      const isPayrollRelatedCurrentExpense =
        isPayrollApplication &&
        nature.categoryCode === '3' &&
        nature.groupCode === '3' &&
        PAYROLL_RELATED_CURRENT_EXPENSE_ELEMENTS.has(nature.elementCode);
      if (isPersonnelGroup || isPayrollRelatedCurrentExpense) {
        addTotals(totals, line);
      }
    }
  }
  return totals;
}

// ── Por elemento de despesa ──────────────────────────────────────────────────

/**
 * Agrega por elemento de despesa (4ª posição da natureza da despesa).
 *
 * Linhas cujo código não puder ser interpretado caem no bucket `SEM_CLASSIFICACAO`
 * em vez de serem descartadas — assim a soma das linhas continua fechando com o
 * total geral, e um QDD com código fora do padrão fica visível em vez de sumir.
 */
export function aggregateByElement(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const nature = parseExpenseAccount(line.expenseAccount);
    const code = nature?.elementCode ?? 'SEM_CLASSIFICACAO';
    const name = nature
      ? expenseElementName(code, cleanExpenseDescription(line.expenseDescription ?? ''))
      : 'Sem classificação';
    const bucket = bucketOf(map, code, nature ? `${code} — ${name}` : name, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

/**
 * Molde comum das agregações por uma posição da natureza da despesa cujo rótulo
 * sai de um catálogo fixo (categoria, grupo, modalidade). O elemento não usa este
 * molde porque tem um fallback próprio pela descrição do QDD.
 */
function aggregateByNaturePart(
  actions: BudgetAction[],
  pick: (nature: NonNullable<ReturnType<typeof parseExpenseAccount>>) => string,
  catalog: Record<string, string>,
  fallbackPrefix: string,
): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const nature = parseExpenseAccount(line.expenseAccount);
    const code = nature ? pick(nature) : 'SEM_CLASSIFICACAO';
    const name = nature ? catalog[code] ?? `${fallbackPrefix} ${code}` : 'Sem classificação';
    const bucket = bucketOf(map, code, nature ? `${code} — ${name}` : name, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

/** Agrega por grupo de natureza da despesa (pessoal, investimentos, etc.). */
export function aggregateByGroup(actions: BudgetAction[]): ExecutionRow[] {
  return aggregateByNaturePart(actions, (n) => n.groupCode, EXPENSE_GROUPS, 'Grupo');
}

/** Agrega por categoria econômica (correntes, capital, reserva de contingência). */
export function aggregateByCategory(actions: BudgetAction[]): ExecutionRow[] {
  return aggregateByNaturePart(actions, (n) => n.categoryCode, EXPENSE_CATEGORIES, 'Categoria');
}

/** Agrega por modalidade de aplicação (aplicação direta, transferências, etc.). */
export function aggregateByModality(actions: BudgetAction[]): ExecutionRow[] {
  return aggregateByNaturePart(actions, (n) => n.modalityCode, EXPENSE_MODALITIES, 'Modalidade');
}

// ── Por ação orçamentária ────────────────────────────────────────────────────

/** Agrega por ação (projeto/atividade + aplicação), o nível que o QDD já entrega. */
export function aggregateByAction(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const action of actions) {
    const application = action.application?.trim() || 'Sem descrição';
    const bucket = bucketOf(
      map,
      action.id,
      `${action.projectActivity} — ${application}`,
      application,
    );
    bucket.count += 1;
    addTotals(bucket, action.totals);
  }
  return finish(map);
}

/** Agrega por órgão — útil como filtro/visão cruzada em qualquer aba. */
export function aggregateByOrganization(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const action of actions) {
    const name = action.organizationName?.trim() || action.organizationCode;
    const acronym = organizationAcronym(action.organizationCode, name);
    const bucket = bucketOf(
      map,
      action.organizationCode,
      `${action.organizationCode} — ${name}`,
      acronym,
      acronym,
    );
    bucket.count += 1;
    addTotals(bucket, action.totals);
  }
  return finish(map);
}

// ── Emendas parlamentares ────────────────────────────────────────────────────

export type AmendmentType = 'INDIVIDUAL' | 'BANCADA' | 'COMISSAO' | 'RELATOR' | 'NAO_IDENTIFICADO';

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  INDIVIDUAL: 'Individuais',
  BANCADA: 'De bancada',
  COMISSAO: 'De comissão',
  RELATOR: 'De relator',
  NAO_IDENTIFICADO: 'Tipo não identificado',
};

/**
 * Deduz o tipo da emenda pelo rótulo da fonte de recurso.
 *
 * Só funciona para as fontes catalogadas em `fontes-recursos.ts` — que são as de
 * emendas **federais**. Emendas custeadas por fonte do tesouro estadual não têm o
 * tipo declarado no QDD e caem em `NAO_IDENTIFICADO`; isso é uma limitação do dado
 * de origem, não do cálculo.
 */
export function amendmentTypeFromSource(source: string | null | undefined): AmendmentType {
  const label = getFonteLabel(source)?.toLowerCase() ?? '';
  if (!label.includes('emenda')) return 'NAO_IDENTIFICADO';
  if (label.includes('individua')) return 'INDIVIDUAL';
  if (label.includes('bancada')) return 'BANCADA';
  if (label.includes('comiss')) return 'COMISSAO';
  if (label.includes('relator')) return 'RELATOR';
  return 'NAO_IDENTIFICADO';
}

/** Só as ações que são emenda parlamentar, pela regra já existente do projeto. */
export function amendmentActions(actions: BudgetAction[]): BudgetAction[] {
  return actions.filter((action) => actionIsAmendment(action));
}

/** Emendas agregadas por ação — o nível em que uma emenda aparece no QDD. */
export function aggregateAmendments(actions: BudgetAction[]): ExecutionRow[] {
  return aggregateByAction(amendmentActions(actions));
}

/**
 * Emendas agregadas por tipo. Percorre as linhas (a fonte está na linha), somando
 * apenas as linhas de ações que são emenda.
 */
export function aggregateAmendmentsByType(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(amendmentActions(actions))) {
    const type = amendmentTypeFromSource(line.source);
    const label = AMENDMENT_TYPE_LABELS[type];
    const bucket = bucketOf(map, type, label, label);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}

// ── Por fonte de recurso ─────────────────────────────────────────────────────

/** Agrega por fonte de recurso, rotulando pelo catálogo oficial das fontes. */
export function aggregateBySource(actions: BudgetAction[]): ExecutionRow[] {
  const map = new Map<string, Bucket>();
  for (const line of linesOf(actions)) {
    const code = line.source?.trim() || 'Sem fonte';
    const name = getFonteLabel(code) ?? 'Fonte não catalogada';
    const bucket = bucketOf(map, code, `${code} — ${name}`, name);
    bucket.count += 1;
    addTotals(bucket, line);
  }
  return finish(map);
}
