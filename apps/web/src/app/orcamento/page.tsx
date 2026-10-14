'use client';

import {
  ArrowLeftIcon,
  DownloadIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PayrollPanel, type PayrollDto } from '@/components/domain/payroll-panel';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FiscalSecretariatView } from '@/components/domain/fiscal-secretariat-view';
import {
  BubbleScatter,
  DonutChart,
  DumbbellChart,
  KpiStrip,
  LollipopList,
  SequentialLegend,
  ShareLegend,
  TreemapChart,
  VizBlock,
  VizEmpty,
  paintItems,
  readableLabel,
} from '@/components/domain/execution-visuals';
import { ExerciseSelect } from '@/components/domain/exercise-select';
import { OverviewScheduledActionsPanel } from '@/components/domain/overview-scheduled-actions-panel';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { api, clearStoredSession, getStoredSession, type Session } from '@/lib/api';
import {
  CHART_CATEGORICAL,
  CHART_OTHER,
  categoricalColor,
  sequentialExecutionColor,
  sequentialExecutionInk,
} from '@/lib/chart-palette';
import { shareOf, topWithOther } from '@/lib/chart-geometry';
import {
  aggregateBudgetChangesByOrganization,
  aggregateByAction,
  aggregateByElement,
  aggregateByOrganization,
  aggregateBySource,
  amendmentActions,
  centralPayrollActionsForTargets,
  totalsOf,
  type BudgetChangeRow,
  type ExecutionRow,
  type ExecutionTotals,
} from '@/lib/execution-monitor';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { getFonteLabel } from '@/lib/fontes-recursos';
import { compactMoney, formatPercent, signedCompactMoney } from '@/lib/number-format';
import { organizationAcronym } from '@/lib/organization-acronym';
import { readableName } from '@/lib/readable-name';
import { exerciseQuery, useExercise } from '@/lib/use-exercise';
import { payrollHeadcountForQddScope } from '@/lib/payroll-scope';
import { cn } from '@/lib/utils';
import type { BudgetAction, Metadata, Organization } from '@/types/domain';

const allValue = 'ALL';

/**
 * Recortes da tela. Antes havia uma dimensão por recorte (elemento, ação, fonte), mas
 * as três exibiam o mesmo conjunto de gráficos em ordens diferentes — só mudavam de
 * posição. Foram fundidas em `geral`; as emendas continuam separadas porque ali o
 * recorte é feito apenas sobre as ações de emenda, e não sobre o total.
 */
type ViewId = 'geral' | 'amendments';
/**
 * Visualizações da execução. `Tabela` foi retirada em 2026-10-01; `Gráficos` saiu na
 * mesma data e voltou em 2026-10-14 (contrato, seção 9, item 26).
 */
type ContentView = 'actions' | 'overview' | 'fiscal' | 'payroll';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'amendments', label: 'Emendas parlamentares' },
];

const CONTENT_VIEWS: { id: ContentView; label: string }[] = [
  { id: 'actions', label: 'Ações' },
  { id: 'overview', label: 'Gráficos' },
  { id: 'fiscal', label: 'Órgão' },
  { id: 'payroll', label: 'Folha de pagamento' },
];

/**
 * Grade da aba Gráficos: duas colunas só a partir de 1180px. Cada bloco tem gráfico e
 * legenda lado a lado, e abaixo de ~520px por coluna a legenda espreme os nomes
 * (contrato, seção 9, item 2).
 */
const gridClass = 'grid grid-cols-1 gap-x-10 gap-y-8 px-6 pb-10 pt-8 xl:px-10 min-[1180px]:grid-cols-2';

/** Margem lateral única da página (contrato, seção 3). */
const pagePadding = 'px-6 xl:px-10';

/** "Ações, Gráficos, Órgão e Folha de pagamento" — derivado para não desatualizar o rótulo. */
const CONTENT_VIEWS_LABEL = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(
  CONTENT_VIEWS.map((item) => item.label),
);

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function normalizeSourceCode(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/\D/g, '') || trimmed;
}

/** Ordena por dotação atualizada: as agregações chegam pelo liquidado. */
function byBudget<T extends { updatedBudget: number }>(rows: T[]): T[] {
  return [...rows].filter((row) => row.updatedBudget > 0).sort((a, b) => b.updatedBudget - a.updatedBudget);
}

/** Os oito órgãos que mais mudaram de dotação desde a lei, em valor absoluto. */
function largestChanges(rows: BudgetChangeRow[]): BudgetChangeRow[] {
  return rows
    .filter((row) => Math.abs(row.netChange) > 0.005)
    .sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange))
    .slice(0, 8);
}

/** Bloco comum às duas grades: halteres da dotação, lei → atualizada. */
function BudgetChangeBlock({ rows }: { rows: BudgetChangeRow[] }) {
  const increases = rows.reduce((sum, row) => sum + row.increases, 0);
  const reductions = rows.reduce((sum, row) => sum + row.reductions, 0);
  const net = increases + reductions;
  const moved = largestChanges(rows);
  return (
    <VizBlock
      title="Como a dotação mudou desde a lei"
      summary={
        moved.length ? (
          <>
            Saldo de <b>{signedCompactMoney(net)}</b>: {compactMoney(increases)} em acréscimos e{' '}
            {compactMoney(-reductions)} em reduções, por linha do QDD.
          </>
        ) : undefined
      }
    >
      {moved.length ? (
        <DumbbellChart rows={moved} />
      ) : (
        <VizEmpty>
          Nenhuma alteração de dotação no recorte: a dotação atualizada é igual à da lei em todas as linhas.
        </VizEmpty>
      )}
    </VizBlock>
  );
}

/** Grade do recorte Geral (contrato, seção 3.5). */
const GeneralCharts = memo(function GeneralCharts({
  totals,
  elementRows,
  sourceRows,
  organizationRows,
  changeRows,
}: {
  totals: ExecutionTotals;
  elementRows: ExecutionRow[];
  sourceRows: ExecutionRow[];
  organizationRows: ExecutionRow[];
  changeRows: BudgetChangeRow[];
}) {
  const elements = byBudget(elementRows).slice(0, 10);
  const elementItems = elements.map((row) => ({
    key: row.key,
    label: row.label,
    short: readableName(row.shortLabel),
    value: row.updatedBudget,
    rate: row.executionRate,
    color: sequentialExecutionColor(row.executionRate),
    ink: sequentialExecutionInk(row.executionRate),
  }));
  const sourceItems = paintItems(
    topWithOther(
      byBudget(sourceRows).map((row) => ({ key: row.key, label: readableName(row.shortLabel), value: row.updatedBudget })),
      5,
      'Demais fontes',
      totals.updatedBudget,
    ),
    CHART_CATEGORICAL,
  );
  const organizations = organizationRows.filter((row) => row.updatedBudget > 0);
  const lowExecution = organizations.filter((row) => row.executionRate < 25).length;
  const firstElement = elements[0];
  const firstSource = sourceItems[0];

  return (
    <div className={gridClass}>
      <VizBlock
        title="Para onde vai a despesa"
        summary={
          firstElement ? (
            <>
              {readableName(firstElement.shortLabel)} é o maior elemento (<b>{compactMoney(firstElement.updatedBudget)}</b>).
              Área = dotação; cor = % executado.
            </>
          ) : undefined
        }
      >
        {elementItems.length ? (
          <>
            <TreemapChart items={elementItems} label="Dotação atualizada por elemento de despesa" />
            <SequentialLegend />
          </>
        ) : (
          <VizEmpty>Nenhum elemento de despesa com dotação no recorte.</VizEmpty>
        )}
      </VizBlock>
      <VizBlock
        title="De onde vem o recurso"
        summary={
          firstSource ? (
            <>
              {firstSource.label} financia <b>{formatPercent(shareOf(firstSource.value, totals.updatedBudget))}</b> da
              dotação.
            </>
          ) : undefined
        }
      >
        {sourceItems.length ? (
          <div className="grid items-center gap-x-7 gap-y-6 sm:grid-cols-[200px_minmax(0,1fr)]">
            <DonutChart
              items={sourceItems}
              total={totals.updatedBudget}
              center={compactMoney(totals.updatedBudget)}
              caption="dotação"
              label="Dotação atualizada por fonte de recurso"
            />
            <ShareLegend items={sourceItems} total={totals.updatedBudget} />
          </div>
        ) : (
          <VizEmpty>Nenhuma fonte de recurso com dotação no recorte.</VizEmpty>
        )}
      </VizBlock>
      <VizBlock
        title="Quem tem orçamento grande e execução baixa"
        summary={
          organizations.length ? (
            <>
              <b>
                {lowExecution} de {organizations.length}
              </b>{' '}
              {organizations.length === 1 ? 'órgão' : 'órgãos'} abaixo de 25% de execução. Área do círculo = valor pago.
            </>
          ) : undefined
        }
      >
        {organizations.length ? (
          <BubbleScatter rows={organizations} />
        ) : (
          <VizEmpty>Nenhum órgão com dotação no recorte.</VizEmpty>
        )}
      </VizBlock>
      <BudgetChangeBlock rows={changeRows} />
    </div>
  );
});

/** Grade do recorte Emendas parlamentares (contrato, seção 3.5). */
const AmendmentCharts = memo(function AmendmentCharts({
  totals,
  organizationRows,
  actionRows,
  elementRows,
  changeRows,
}: {
  totals: ExecutionTotals;
  organizationRows: ExecutionRow[];
  actionRows: ExecutionRow[];
  elementRows: ExecutionRow[];
  changeRows: BudgetChangeRow[];
}) {
  const organizations = byBudget(organizationRows);
  const organizationItems = organizations.slice(0, 12).map((row, index) => ({
    key: row.key,
    label: row.label,
    short: row.chartLabel ?? row.shortLabel,
    value: row.updatedBudget,
    color: index < CHART_CATEGORICAL.length ? categoricalColor(index) : CHART_OTHER,
    ink: '#ffffff',
  }));
  const largest = byBudget(actionRows)
    .slice(0, 6)
    .map((row) => ({ key: row.key, label: readableLabel(row.label), value: row.updatedBudget, rate: row.executionRate }));
  const elementItems = paintItems(
    topWithOther(
      byBudget(elementRows).map((row) => ({ key: row.key, label: readableName(row.shortLabel), value: row.updatedBudget })),
      5,
      'Demais elementos',
      totals.updatedBudget,
    ),
    CHART_CATEGORICAL,
  );
  const firstOrganization = organizations[0];
  const firstElement = elementItems[0];

  return (
    <div className={gridClass}>
      <VizBlock
        title="Quem recebe as emendas"
        summary={
          firstOrganization ? (
            <>
              {firstOrganization.chartLabel ?? firstOrganization.shortLabel} lidera, com{' '}
              <b>{compactMoney(firstOrganization.updatedBudget)}</b>.
            </>
          ) : undefined
        }
      >
        {organizationItems.length ? (
          <TreemapChart items={organizationItems} label="Dotação das emendas por órgão" />
        ) : (
          <VizEmpty>Nenhuma emenda parlamentar com dotação no recorte.</VizEmpty>
        )}
      </VizBlock>
      <VizBlock title="Maiores emendas" summary={largest.length ? 'As seis ações de emenda com maior dotação.' : undefined}>
        {largest.length ? (
          <LollipopList rows={largest} />
        ) : (
          <VizEmpty>Nenhuma ação de emenda com dotação no recorte.</VizEmpty>
        )}
      </VizBlock>
      <VizBlock
        title="Onde o dinheiro das emendas é aplicado"
        summary={
          firstElement ? (
            <>
              {firstElement.label} responde por <b>{formatPercent(shareOf(firstElement.value, totals.updatedBudget))}</b>.
            </>
          ) : undefined
        }
      >
        {elementItems.length ? (
          <div className="grid items-center gap-x-7 gap-y-6 sm:grid-cols-[200px_minmax(0,1fr)]">
            <DonutChart
              items={elementItems}
              total={totals.updatedBudget}
              center={compactMoney(totals.updatedBudget)}
              caption="em emendas"
              label="Dotação das emendas por elemento de despesa"
            />
            <ShareLegend items={elementItems} total={totals.updatedBudget} />
          </div>
        ) : (
          <VizEmpty>Nenhum elemento de despesa com dotação de emenda no recorte.</VizEmpty>
        )}
      </VizBlock>
      <BudgetChangeBlock rows={changeRows} />
    </div>
  );
});

function OrcamentoPageContent() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [view, setView] = useState<ViewId>('geral');
  const [contentView, setContentView] = useState<ContentView>('actions');
  const [showAllStages, setShowAllStages] = useState(false);
  const [payroll, setPayroll] = useState<PayrollDto | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');

  const [organizationCode, setOrganizationCode] = useState(allValue);
  const [unitFilter, setUnitFilter] = useState(allValue);
  const [sourceFilter, setSourceFilter] = useState(allValue);
  const [functionFilter, setFunctionFilter] = useState(allValue);
  const [subfunctionFilter, setSubfunctionFilter] = useState(allValue);
  const [search, setSearch] = useState('');

  const { requestedYear, year, setYear } = useExercise(metadata?.currentYear);
  /**
   * Exercício efetivamente carregado, conforme o servidor. Difere de `year` quando
   * a URL pede um exercício inexistente — nesse caso o servidor devolve o corrente,
   * e rotular os dados pelo ano da URL mostraria o catálogo de fontes errado.
   */
  const loadedYear = metadata?.year ?? null;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // `requestedYear` (e não `year`) para não recarregar quando o metadata chega.
      const q = exerciseQuery(requestedYear);
      const [loadedActions, loadedOrganizations, loadedMetadata] = await Promise.all([
        api<BudgetAction[]>(`/budget-actions${q}`),
        api<Organization[]>(`/organizations${q}`),
        api<Metadata>(`/metadata${q}`),
      ]);
      setActions(loadedActions);
      setOrganizations(loadedOrganizations);
      setMetadata(loadedMetadata);

      // A folha vem de fonte externa e é opcional: se a coleta ainda não rodou ou o
      // portal estiver fora do ar, o resto do painel não pode deixar de carregar.
      // Ela NÃO acompanha o exercício: mostra sempre o mês mais recente publicado.
      api<PayrollDto>('/payroll')
        .then(setPayroll)
        .catch(() => setPayroll(null));
    } finally {
      setIsLoading(false);
    }
  }, [requestedYear]);

  // Sessão e redirecionamento vivem num efeito próprio: juntá-los à carga faria o
  // redirect ser reavaliado a cada troca de exercício.
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      router.push('/login');
      return;
    }
    if (stored.user.role !== 'SEPLAN_ADMIN') {
      router.push('/secretaria');
      return;
    }
    setSession(stored);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    load().catch((error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao carregar os dados da execução orçamentária.',
      );
    });
  }, [session, load]);

  // Se a URL pedia um exercício que não existe, o servidor devolveu o corrente:
  // alinhar a URL evita que o seletor mostre um ano que não é o dos dados.
  useEffect(() => {
    if (loadedYear == null || requestedYear == null) return;
    if (loadedYear !== requestedYear) setYear(loadedYear);
  }, [loadedYear, requestedYear, setYear]);

  // A estrutura do QDD muda entre exercícios: manter órgão/unidade/fonte de outro
  // ano deixaria a tela filtrada por algo que não existe no exercício escolhido.
  const changeYear = useCallback(
    (next: number) => {
      setOrganizationCode(allValue);
      setUnitFilter(allValue);
      setSourceFilter(allValue);
      setFunctionFilter(allValue);
      setSubfunctionFilter(allValue);
      setSearch('');
      setYear(next);
    },
    [setYear],
  );

  // Replica a transição lateral de "Informações Gerais". Campos e controles de
  // seleção preservam as setas para sua própria navegação.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[role="combobox"]') ||
        target.closest('[data-slot="tabs-trigger"]')
      ) {
        return;
      }
      setContentView((current) => {
        const index = CONTENT_VIEWS.findIndex((item) => item.id === current);
        const nextIndex =
          event.key === 'ArrowLeft'
            ? Math.max(0, index - 1)
            : Math.min(CONTENT_VIEWS.length - 1, index + 1);
        return CONTENT_VIEWS[nextIndex]?.id ?? current;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    clearStoredSession();
    router.push('/login');
  }

  // Órgãos derivados das ações do exercício carregado — como já acontece com
  // unidade e fonte. A estrutura de governo muda entre exercícios, então usar o
  // cadastro como fonte ofereceria órgãos que não existem no ano escolhido (e
  // omitiria os que só existem nele). O nome do cadastro é preferido quando há;
  // senão vale o do próprio QDD.
  const organizationEntries = useMemo(() => {
    const nameByCode = new Map(organizations.map((organization) => [organization.code, organization.name]));
    const byCode = new Map<string, string>();
    for (const action of actions) {
      if (byCode.has(action.organizationCode)) continue;
      byCode.set(
        action.organizationCode,
        nameByCode.get(action.organizationCode) ?? action.organizationName,
      );
    }
    return [...byCode.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([code, name]) => ({ value: code, label: `${code} — ${name}` }));
  }, [actions, organizations]);

  // Sem rótulo visível na linha de filtros: o próprio valor diz o filtro.
  const organizationOptions = useMemo(
    () => [{ value: allValue, label: 'Órgão: todos' }, ...organizationEntries],
    [organizationEntries],
  );
  const fiscalOrganizationOptions = useMemo(
    () => [{ value: allValue, label: 'Selecione uma secretaria' }, ...organizationEntries],
    [organizationEntries],
  );

  const unitOptions = useMemo(() => {
    const units = new Map<string, { value: string; label: string }>();
    for (const action of actions) {
      if (organizationCode !== allValue && action.organizationCode !== organizationCode) continue;
      const value = `${action.organizationCode}|${action.unitCode}`;
      if (units.has(value)) continue;
      units.set(value, {
        value,
        label:
          organizationCode === allValue
            ? `${action.organizationCode}/${action.unitCode} — ${action.unitName}`
            : `${action.unitCode} — ${action.unitName}`,
      });
    }
    return [
      { value: allValue, label: 'Unidade: todas' },
      ...[...units.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    ];
  }, [actions, organizationCode]);

  const sourceOptions = useMemo(() => {
    const sources = new Map<string, { value: string; label: string }>();
    for (const action of actions) {
      if (organizationCode !== allValue && action.organizationCode !== organizationCode) continue;
      if (
        unitFilter !== allValue &&
        `${action.organizationCode}|${action.unitCode}` !== unitFilter
      ) {
        continue;
      }
      for (const line of action.expenseLines ?? []) {
        const code = normalizeSourceCode(line.source ?? '');
        if (!code || sources.has(code)) continue;
        sources.set(code, {
          value: code,
          label: `${code} — ${getFonteLabel(code, loadedYear) ?? 'Fonte não catalogada'}`,
        });
      }
    }
    return [
      { value: allValue, label: 'Fonte: todas' },
      ...[...sources.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    ];
  }, [actions, organizationCode, unitFilter, loadedYear]);

  const filteredActions = useMemo(() => {
    const term = normalize(search.trim());
    return actions.filter((action) => {
      if (organizationCode !== allValue && action.organizationCode !== organizationCode) return false;
      if (
        unitFilter !== allValue &&
        `${action.organizationCode}|${action.unitCode}` !== unitFilter
      ) {
        return false;
      }
      if (
        sourceFilter !== allValue &&
        !(action.expenseLines ?? []).some(
          (line) => normalizeSourceCode(line.source ?? '') === sourceFilter,
        )
      ) {
        return false;
      }
      if (!actionMatchesFunctionalFilters(action, functionFilter, subfunctionFilter, allValue)) return false;
      if (!term) return true;
      return (
        normalize(action.application).includes(term) ||
        normalize(action.projectActivity).includes(term) ||
        normalize(action.functionalProgram).includes(term) ||
        normalize(action.organizationName).includes(term)
      );
    });
  }, [
    actions,
    organizationCode,
    unitFilter,
    sourceFilter,
    functionFilter,
    subfunctionFilter,
    search,
  ]);

  const totals = useMemo(() => totalsOf(filteredActions), [filteredActions]);
  const fiscalActions = useMemo(
    () =>
      actions.filter((action) => {
        if (organizationCode === allValue || action.organizationCode !== organizationCode) {
          return false;
        }
        if (
          unitFilter !== allValue &&
          `${action.organizationCode}|${action.unitCode}` !== unitFilter
        ) {
          return false;
        }
        return true;
      }),
    [actions, organizationCode, unitFilter],
  );
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.code === organizationCode),
    [organizations, organizationCode],
  );
  // Nome do recorte na linha de filtros: a unidade quando há uma escolhida, senão o
  // órgão, senão nada (os demais filtros não têm nome curto).
  const headingTitle = useMemo(() => {
    if (unitFilter !== allValue) {
      const unitAction = actions.find(
        (action) => `${action.organizationCode}|${action.unitCode}` === unitFilter,
      );
      if (unitAction) return `${unitAction.unitCode} — ${readableName(unitAction.unitName)}`;
    }
    if (selectedOrganization) {
      return `${selectedOrganization.code} — ${readableName(selectedOrganization.name)}`;
    }
    return null;
  }, [actions, selectedOrganization, unitFilter]);
  const fiscalPayrollHeadcount = useMemo(
    () =>
      payrollHeadcountForQddScope(
        payroll,
        organizationCode,
        unitFilter,
        allValue,
      ),
    [organizationCode, payroll, unitFilter],
  );
  const personnelScope = useMemo(
    () => {
      if (!selectedOrganization) {
        return {
          localActions: [] as BudgetAction[],
          centralActions: [] as BudgetAction[],
          label: '',
          note: '',
        };
      }
      const organizationTarget = {
        organizationCode: selectedOrganization.code,
        name: selectedOrganization.name,
        acronym: organizationAcronym(
          selectedOrganization.code,
          selectedOrganization.name,
        ),
      };
      const unitsByCode = new Map<
        string,
        { organizationCode: string; unitCode: string; name: string }
      >();
      const organizationActions: BudgetAction[] = [];
      for (const action of actions) {
        if (action.organizationCode !== selectedOrganization.code) continue;
        organizationActions.push(action);
        if (!unitsByCode.has(action.unitCode)) {
          unitsByCode.set(action.unitCode, {
            organizationCode: action.organizationCode,
            unitCode: action.unitCode,
            name: action.unitName,
          });
        }
      }
      const organizationTargets = [organizationTarget, ...unitsByCode.values()];
      const organizationCentralActions = centralPayrollActionsForTargets(
        actions,
        organizationTargets,
      );

      if (unitFilter === allValue) {
        return {
          localActions: organizationActions,
          centralActions: organizationCentralActions,
          label: 'Secretaria e unidades vinculadas',
          note: 'Consolidação no nível da secretaria.',
        };
      }

      const selectedUnitCode = unitFilter.split('|')[1] ?? '';
      const selectedUnit = unitsByCode.get(selectedUnitCode);
      const unitMatches = selectedUnit
        ? centralPayrollActionsForTargets(actions, [selectedUnit])
        : [];
      if (unitMatches.length) {
        return {
          localActions: fiscalActions,
          centralActions: unitMatches,
          label: selectedUnit?.name ?? 'Unidade selecionada',
          note: 'A unidade possui ação própria identificada na folha centralizada.',
        };
      }

      return {
        localActions: organizationActions,
        centralActions: organizationCentralActions,
        label: 'Secretaria consolidada',
        note:
          'A unidade não possui ação própria na folha; por isso, a folha é apresentada no nível da secretaria, sem rateio.',
      };
    },
    [actions, fiscalActions, selectedOrganization, unitFilter],
  );
  // Recorte de emendas: as ações de emenda dentro dos filtros da linha.
  const amendments = useMemo(() => amendmentActions(filteredActions), [filteredActions]);
  const amendmentTotals = useMemo(() => totalsOf(amendments), [amendments]);

  // Recortes da aba Gráficos. Na grade de emendas, todos são calculados sobre as
  // ações de emenda, e não sobre o conjunto todo — é isso que os torna informativos
  // ali em vez de repetição da grade geral.
  const elementRows = useMemo(() => aggregateByElement(filteredActions), [filteredActions]);
  const sourceRows = useMemo(() => aggregateBySource(filteredActions), [filteredActions]);
  const organizationRows = useMemo(() => aggregateByOrganization(filteredActions), [filteredActions]);
  const budgetChangeRows = useMemo(
    () => aggregateBudgetChangesByOrganization(filteredActions),
    [filteredActions],
  );
  const amendmentOrganizationRows = useMemo(() => aggregateByOrganization(amendments), [amendments]);
  const amendmentRows = useMemo(() => aggregateByAction(amendments), [amendments]);
  const amendmentElementRows = useMemo(() => aggregateByElement(amendments), [amendments]);
  const amendmentBudgetChangeRows = useMemo(
    () => aggregateBudgetChangesByOrganization(amendments),
    [amendments],
  );

  // O recorte é dominante na tela: com `Emendas parlamentares` ativo, régua,
  // exportação e a tabela de ações refletem apenas as ações de emenda — os filtros
  // da linha continuam valendo dentro dele.
  const dimensionActions = view === 'amendments' ? amendments : filteredActions;

  const hasFilters =
    organizationCode !== allValue ||
    unitFilter !== allValue ||
    sourceFilter !== allValue ||
    functionFilter !== allValue ||
    subfunctionFilter !== allValue ||
    search.trim() !== '';

  function clearFilters() {
    setOrganizationCode(allValue);
    setUnitFilter(allValue);
    setSourceFilter(allValue);
    setFunctionFilter(allValue);
    setSubfunctionFilter(allValue);
    setSearch('');
  }

  const changeOrganization = useCallback((value: string) => {
    setOrganizationCode(value);
    setUnitFilter(allValue);
    setSourceFilter(allValue);
  }, []);
  const changeUnit = useCallback((value: string) => {
    setUnitFilter(value);
    setSourceFilter(allValue);
  }, []);

  // Exportação cliente-side sobre o recorte (`dimensionActions`): com Emendas
  // parlamentares ativo, o arquivo carrega só as ações de emenda; em Geral, todo o
  // recorte dos filtros. Import dinâmico, como no painel de ações, para não pesar o
  // bundle.
  const handleExport = useCallback(async () => {
    if (dimensionActions.length === 0) {
      toast.error('Não há ações correspondentes aos filtros aplicados para exportar.');
      return;
    }
    const exportYear = loadedYear ?? year;
    if (exportYear == null) {
      toast.error('Aguarde o carregamento dos dados antes de exportar.');
      return;
    }
    try {
      const { buildExecutionRows, exportExecution } = await import('@/lib/execution-export');
      const rows = buildExecutionRows(dimensionActions);
      exportExecution(rows, exportFormat, exportYear);
      setExportOpen(false);
      toast.success(
        `Exportação ${exportFormat.toUpperCase()} concluída (${rows.length} linha(s)).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar.');
    }
  }, [dimensionActions, exportFormat, loadedYear, year]);

  if (!session) return null;

  const isExecutiveView = contentView === 'fiscal' || contentView === 'payroll';
  const isAmendmentsDimension = view === 'amendments';
  // Régua segue o recorte: em Emendas parlamentares, os totais das ações de emenda.
  const dimensionTotals = isAmendmentsDimension ? amendmentTotals : totals;

  return (
    <div className="orcamento-page-root min-h-svh w-full bg-white text-[#141714]">
      <header className="orcamento-app-header flex h-14 items-center gap-5 bg-marca text-marca-contraste">
        <div className={cn('flex w-full min-w-0 items-center gap-3 sm:gap-5', pagePadding)}>
          <img src="/logo.svg" alt="SEPLAN" className="hidden h-7 w-auto shrink-0 sm:block" />
          <span className="truncate text-base font-semibold">Execução orçamentária</span>
          {/* Rota de fuga do módulo: no cabeçalho, porque ele existe em todas as abas. */}
          <button
            type="button"
            onClick={() => router.push('/seplan')}
            className="inline-flex shrink-0 items-center gap-1.5 text-[13.5px] text-marca-contraste/80 hover:text-marca-contraste focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-contraste"
            title="Voltar a Orçamentos Temáticos"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            <span className="hidden md:inline">Orçamentos Temáticos</span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="mr-2">
              <ExerciseSelect
                exercises={metadata?.exercises ?? []}
                year={loadedYear ?? year}
                onChange={changeYear}
                disabled={isLoading}
              />
            </div>
            <Button
              variant="ghost"
              className="rounded-none text-marca-contraste shadow-none hover:bg-marca-hover hover:text-marca-contraste"
              onClick={() => void load()}
              disabled={isLoading}
            >
              <RefreshCwIcon data-icon="inline-start" className={cn(isLoading && 'animate-spin')} />
              <span className="hidden lg:inline">Atualizar</span>
            </Button>
            <Button
              variant="ghost"
              className="rounded-none text-marca-contraste shadow-none hover:bg-marca-hover hover:text-marca-contraste"
              onClick={signOut}
              disabled={isSigningOut}
            >
              <LogOutIcon data-icon="inline-start" />
              <span className="hidden lg:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/*
        Faixa de navegação: fica fora do `<main>` e presa ao topo ao rolar. Nas visões
        executivas (Órgão, Folha) é a única navegação da tela.
      */}
      <nav
        aria-label="Navegação entre visualizações"
        className={cn(
          'orcamento-view-bar sticky top-0 z-30 flex items-end gap-8 border-b border-[#e1e3dd] bg-white',
          pagePadding,
        )}
      >
        <div className="flex min-w-0 overflow-x-auto">
          <div role="tablist" aria-label="Visualizações da execução" className="flex shrink-0 gap-8">
            {CONTENT_VIEWS.map((item) => {
              const active = contentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setContentView(item.id)}
                  className={cn(
                    '-mb-px shrink-0 border-b-[3px] pb-3.5 pt-[18px] text-[15px] font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-marca',
                    active
                      ? 'border-marca text-[#141714]'
                      : 'border-transparent text-[#80857f] hover:text-[#141714]',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Some sem tirar o lugar: as abas não mudam de posição ao trocar de visão. */}
        <div
          className={cn('ml-auto hidden shrink-0 items-baseline gap-4 pb-[15px] sm:flex', isExecutiveView && 'invisible')}
          aria-hidden={isExecutiveView}
        >
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[#80857f]">Recorte</span>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              tabIndex={isExecutiveView ? -1 : undefined}
              onClick={() => setView(item.id)}
              className={cn(
                'border-b-2 pb-0.5 text-sm transition-colors',
                view === item.id
                  ? 'border-[#141714] font-semibold text-[#141714]'
                  : 'border-transparent text-[#80857f] hover:text-[#141714]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="orcamento-main min-w-0">
        {!isExecutiveView ? (
          <>
            <div
              className={cn(
                'orcamento-filters flex flex-wrap items-center gap-2.5 border-b border-[#e1e3dd] py-3.5',
                pagePadding,
              )}
            >
              {/* Abaixo de `sm` o recorte sai da faixa e vem para cá. */}
              <div className="flex w-full gap-4 pb-1 sm:hidden">
                {VIEWS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={view === item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                      'border-b-2 pb-0.5 text-sm',
                      view === item.id ? 'border-[#141714] font-semibold' : 'border-transparent text-[#80857f]',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="relative w-60 max-w-full">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar ação, programa…"
                  aria-label="Buscar ação ou programa"
                  className="pl-8"
                />
              </div>
              <SearchableCombobox
                className="relative w-40 min-w-0"
                value={organizationCode}
                onChange={changeOrganization}
                placeholder="Órgão: todos"
                items={organizationOptions}
              />
              <SearchableCombobox
                className="relative w-40 min-w-0"
                value={unitFilter}
                onChange={changeUnit}
                placeholder="Unidade: todas"
                items={unitOptions}
              />
              <SearchableCombobox
                className="relative w-40 min-w-0"
                value={sourceFilter}
                onChange={setSourceFilter}
                placeholder="Fonte: todas"
                items={sourceOptions}
              />
              <FunctionalClassificationFilters
                actions={actions}
                functionFilter={functionFilter}
                subfunctionFilter={subfunctionFilter}
                onFunctionChange={setFunctionFilter}
                onSubfunctionChange={setSubfunctionFilter}
                allValue={allValue}
                showLabels={false}
                className="contents *:w-40"
              />
              {/* Sempre presente, para a linha não mudar de forma ao filtrar. */}
              <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters} className="text-[13.5px]">
                Limpar
              </Button>
              <span className="ml-auto truncate text-[13px] text-[#80857f]" title={headingTitle ?? undefined}>
                {hasFilters ? (headingTitle ?? 'Filtros aplicados') : 'Nenhum filtro aplicado'}
              </span>
            </div>

            <KpiStrip
              totals={dimensionTotals}
              isLoading={isLoading}
              amendments={isAmendmentsDimension}
              className="orcamento-global-kpis"
            />
          </>
        ) : null}

        {isLoading ? (
          <div className={cn('py-8', pagePadding)}>
            <Skeleton className="h-96" />
          </div>
        ) : (
          <Tabs
            value={contentView}
            onValueChange={(value) => setContentView(value as ContentView)}
            role="group"
            aria-label={`Visualização da execução — use as setas do teclado para alternar entre ${CONTENT_VIEWS_LABEL}`}
          >
            <TabsContent value="actions" forceMount>
              {/*
                O recorte recorta a aba Ações do mesmo modo que recorta régua e
                exportação: Geral mostra todas as ações filtradas; Emendas
                parlamentares, apenas as ações de emenda.
              */}
              <section className={cn('pb-10 pt-8', pagePadding)}>
                <div className="mb-[18px] flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h2 className="text-[21px] font-semibold tracking-[-0.01em]">
                    Ações orçamentárias{isAmendmentsDimension ? ' — emendas parlamentares' : ''}
                  </h2>
                  <p className="text-sm text-[#80857f] tabular-nums">
                    {dimensionActions.length.toLocaleString('pt-BR')}{' '}
                    {dimensionActions.length === 1 ? 'ação' : 'ações'}, na ordem do QDD
                  </p>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="outline"
                      aria-pressed={showAllStages}
                      onClick={() => setShowAllStages((value) => !value)}
                      className="border-[#141714] bg-white shadow-none hover:bg-stone-100"
                    >
                      {showAllStages ? 'Mostrar só o essencial' : 'Mostrar todos os estágios'}
                    </Button>
                    {/*
                      Exporta o recorte ativo: em Geral, as ações do QDD sob os filtros; em
                      Emendas parlamentares, só as ações de emenda. A folha de pagamento
                      fica de fora por construção: o arquivo nunca contém dado da folha.
                    */}
                    <Popover open={exportOpen} onOpenChange={setExportOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="border-[#c3c6bf] bg-white text-[#4a504b] shadow-none hover:bg-stone-100">
                          <DownloadIcon data-icon="inline-start" />
                          Exportar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 space-y-4">
                        <div className="space-y-1.5">
                          <Label className={filterFieldLabelClass}>Formato</Label>
                          <Select
                            value={exportFormat}
                            onValueChange={(value) => setExportFormat(value as 'xlsx' | 'csv' | 'json')}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                              <SelectItem value="csv">CSV (.csv)</SelectItem>
                              <SelectItem value="json">JSON (.json)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => void handleExport()}
                          disabled={dimensionActions.length === 0}
                        >
                          <DownloadIcon />
                          Exportar recorte filtrado
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <OverviewScheduledActionsPanel
                  actions={dimensionActions}
                  organizations={organizations}
                  variant="execution"
                  showAllStages={showAllStages}
                />
              </section>
            </TabsContent>

            {/*
              Gráficos: uma grade por recorte, as duas montadas (`forceMount`) para não
              piscar ao trocar o recorte (contrato, seção 3.5).
            */}
            <TabsContent value="overview" forceMount>
              <Tabs value={view}>
                <TabsContent value="geral" forceMount>
                  <GeneralCharts
                    totals={totals}
                    elementRows={elementRows}
                    sourceRows={sourceRows}
                    organizationRows={organizationRows}
                    changeRows={budgetChangeRows}
                  />
                </TabsContent>
                <TabsContent value="amendments" forceMount>
                  <AmendmentCharts
                    totals={amendmentTotals}
                    organizationRows={amendmentOrganizationRows}
                    actionRows={amendmentRows}
                    elementRows={amendmentElementRows}
                    changeRows={amendmentBudgetChangeRows}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="fiscal" forceMount>
              <FiscalSecretariatView
                actions={fiscalActions}
                personnelActions={personnelScope.localActions}
                centralPayrollActions={personnelScope.centralActions}
                personnelScopeLabel={personnelScope.label}
                personnelScopeNote={personnelScope.note}
                organization={selectedOrganization}
                organizationCode={organizationCode}
                organizationOptions={fiscalOrganizationOptions}
                unitFilter={unitFilter}
                unitOptions={unitOptions}
                payrollHeadcount={fiscalPayrollHeadcount}
                allValue={allValue}
                onOrganizationChange={changeOrganization}
                onUnitChange={changeUnit}
                vigenteImport={metadata?.vigenteImport}
              />
            </TabsContent>

            {/*
              Folha de pagamento: dado externo (Portal da Transparência), coletado por
              job diário e lido do banco — não depende dos filtros do QDD, que são de
              orçamento e não se aplicam a servidores.
            */}
            <TabsContent value="payroll" forceMount>
              <div className={cn('py-8', pagePadding)}>
                {payroll ? <PayrollPanel data={payroll} /> : <Skeleton className="h-96 w-full" />}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

/**
 * `useExercise` lê `useSearchParams`, que exige um limite de Suspense — sem ele o
 * `next build` falha ao pré-renderizar a rota.
 */
export default function OrcamentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col gap-4 bg-white p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[calc(100vh-8rem)] w-full" />
        </div>
      }
    >
      <OrcamentoPageContent />
    </Suspense>
  );
}
