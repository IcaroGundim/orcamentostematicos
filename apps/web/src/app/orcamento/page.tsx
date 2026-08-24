'use client';

import {
  BanknoteIcon,
  BarChart3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SearchIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CycleLineChart,
  CycleStackedBarChart,
  ExecutionChartCard,
  ExecutionScatterChart,
  ExecutionTablePanel,
} from '@/components/domain/execution-breakdown-panel';
import { PayrollPanel, type PayrollDto } from '@/components/domain/payroll-panel';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FiscalSecretariatView } from '@/components/domain/fiscal-secretariat-view';
import { ExerciseSelect } from '@/components/domain/exercise-select';
import { OverviewScheduledActionsPanel } from '@/components/domain/overview-scheduled-actions-panel';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, useHoverPill } from '@/components/ui/tabs';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { api, clearStoredSession, formatMoney, getStoredSession, type Session } from '@/lib/api';
import {
  EXECUTION_METRIC_LABELS,
  EXECUTION_METRICS,
  type ExecutionMetric,
  aggregateByAction,
  aggregateByCategory,
  aggregateByElement,
  aggregateByGroup,
  aggregateByModality,
  aggregateByOrganization,
  aggregateBySource,
  amendmentActions,
  centralPayrollActionsForTargets,
  executionRate,
  totalsOf,
} from '@/lib/execution-monitor';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { getFonteLabel } from '@/lib/fontes-recursos';
import { organizationAcronym } from '@/lib/organization-acronym';
import { exerciseQuery, useExercise } from '@/lib/use-exercise';
import { payrollHeadcountForQddScope } from '@/lib/payroll-scope';
import { cn } from '@/lib/utils';
import type { BudgetAction, Metadata, Organization } from '@/types/domain';

const allValue = 'ALL';
const PAGE_ZOOM = 0.95;

/**
 * Grade dos gráficos: 3 colunas × 2 linhas a partir de `xl`. Abaixo disso degrada
 * para 2 colunas e depois 1, porque uma célula de gráfico com eixo de categorias
 * fica ilegível em menos de ~330px.
 */
const gridClass =
  'grid h-full min-h-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2';

/**
 * Tabelas empilhadas na aba "Tabela".
 *
 * `shrink-0` é essencial: os cards são itens flex com `min-h-0` e, sem isso, eram
 * espremidos até sobrar uma única linha visível em cada. O teto de altura evita que
 * uma tabela expandida (a de ação tem 74 registros) empurre as demais para fora da
 * vista — ela passa a rolar por dentro.
 */
const STACKED_TABLE_CLASS = 'shrink-0 max-h-[34rem]';

const chartColors = {
  element: '#5f8f70',
  group: '#8fa873',
  category: '#b8b477',
  modality: '#110f24',
  organization: '#c8c89f',
  source: '#5f8f70',
  amendmentOrganization: '#c8c89f',
  amendmentAction: '#110f24',
  amendmentElement: '#5f8f70',
  amendmentSource: '#8fa873',
  amendmentGroup: '#b8b477',
  amendmentCategory: '#110f24',
} as const;

/**
 * Dimensões de análise. Antes havia uma por recorte (elemento, ação, fonte), mas as
 * três exibiam o mesmo conjunto de gráficos em ordens diferentes — só mudavam de
 * posição. Foram fundidas em `geral`; as emendas continuam separadas porque ali os
 * recortes são calculados apenas sobre as ações de emenda, e não sobre o total.
 */
type ViewId = 'geral' | 'amendments';
type ContentView = 'overview' | 'fiscal' | 'actions' | 'table' | 'payroll';

const VIEWS: { id: ViewId; label: string; icon: typeof BarChart3Icon }[] = [
  { id: 'geral', label: 'Geral', icon: CoinsIcon },
  { id: 'amendments', label: 'Emendas parlamentares', icon: ScrollTextIcon },
];

const CONTENT_VIEWS: { id: ContentView; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'fiscal', label: 'Órgão' },
  { id: 'actions', label: 'Ações' },
  { id: 'table', label: 'Tabela' },
  { id: 'payroll', label: 'Folha de pagamento' },
];

function ExecutionViewNavigation({
  activeView,
  onSelect,
  collapsed,
}: {
  activeView: ViewId;
  onSelect: (view: ViewId) => void;
  collapsed: boolean;
}) {
  const pill = useHoverPill(activeView);

  return (
    <div
      ref={pill.listRef}
      className="relative flex flex-wrap border border-black/70 bg-white xl:flex-col xl:border-0"
      role="tablist"
      onMouseLeave={pill.resetHighlight}
    >
      {/*
        Faixa que segue o mouse. Cobre a caixa inteira do item (e não só um eixo),
        para funcionar tanto na coluna do desktop quanto na linha das telas menores.
      */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-0 bg-green-900',
          'transition-[left,top,width,height] duration-500 ease-out',
          pill.pill.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          left: pill.pill.left,
          top: pill.pill.top,
          width: pill.pill.width,
          height: pill.pill.height,
        }}
      />
      {/* Marcador da seleção, na borda inicial do item — desliza junto. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-20 w-[4px] bg-[#b8b477]',
          'transition-[left,top,height] duration-300 ease-out',
          pill.activePill.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          left: pill.activePill.left,
          top: pill.activePill.top,
          height: pill.activePill.height,
        }}
      />
      {VIEWS.map((item) => {
        const Icon = item.icon;
        const highlighted = pill.highlightValue === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeView === item.id}
            data-execution-view={item.id}
            data-hover-tab-value={item.id}
            onClick={() => onSelect(item.id)}
            onFocus={() => pill.highlight(item.id)}
            onMouseEnter={() => pill.highlight(item.id)}
            className={cn(
              'relative z-10 inline-flex min-h-10 items-center gap-2 border-b border-black/20 px-3 py-2 text-xs font-semibold transition-colors',
              'xl:w-full xl:border-l-4 xl:border-l-transparent',
              collapsed ? 'xl:justify-center xl:px-2' : 'xl:justify-start',
              highlighted ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn('text-left leading-tight', collapsed && 'xl:sr-only')}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSourceCode(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/\D/g, '') || trimmed;
}

function OrcamentoPageContent() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<ViewId>('geral');
  const [contentView, setContentView] = useState<ContentView>('overview');
  // Declarado junto dos demais hooks: precisa vir antes do `return null` de sessão
  // ausente, senão a chamada passa a ser condicional.
  const contentViewPill = useHoverPill(contentView);
  const [metric, setMetric] = useState<ExecutionMetric>('updatedBudget');
  const [payroll, setPayroll] = useState<PayrollDto | null>(null);

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

  const organizationOptions = useMemo(
    () => [{ value: allValue, label: 'Todos os órgãos' }, ...organizationEntries],
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
      { value: allValue, label: 'Todas as unidades' },
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
      { value: allValue, label: 'Todas as fontes' },
      ...[...sources.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    ];
  }, [actions, organizationCode, unitFilter]);

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
          'A unidade não possui ação própria na folha; por isso, pessoal é apresentado no nível da secretaria, sem rateio.',
      };
    },
    [actions, fiscalActions, selectedOrganization, unitFilter],
  );
  // Recortes sobre todas as ações filtradas.
  const elementRows = useMemo(() => aggregateByElement(filteredActions), [filteredActions]);
  const groupRows = useMemo(() => aggregateByGroup(filteredActions), [filteredActions]);
  const categoryRows = useMemo(() => aggregateByCategory(filteredActions), [filteredActions]);
  const modalityRows = useMemo(() => aggregateByModality(filteredActions), [filteredActions]);
  const organizationRows = useMemo(() => aggregateByOrganization(filteredActions), [filteredActions]);
  const actionRows = useMemo(() => aggregateByAction(filteredActions), [filteredActions]);
  const sourceRows = useMemo(() => aggregateBySource(filteredActions), [filteredActions]);

  // Aba de emendas: todos os recortes são calculados sobre as ações de emenda, e não
  // sobre o conjunto todo — é isso que os torna informativos ali em vez de repetição
  // das outras abas.
  const amendments = useMemo(() => amendmentActions(filteredActions), [filteredActions]);
  const amendmentCount = amendments.length;
  const amendmentRows = useMemo(() => aggregateByAction(amendments), [amendments]);
  const amendmentOrganizationRows = useMemo(() => aggregateByOrganization(amendments), [amendments]);
  const amendmentElementRows = useMemo(() => aggregateByElement(amendments), [amendments]);
  const amendmentSourceRows = useMemo(() => aggregateBySource(amendments), [amendments]);
  const amendmentGroupRows = useMemo(() => aggregateByGroup(amendments), [amendments]);
  const amendmentCategoryRows = useMemo(() => aggregateByCategory(amendments), [amendments]);

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

  if (!session) return null;

  const rate = executionRate(totals.liquidated, totals.updatedBudget);
  const contentViewIndex = CONTENT_VIEWS.findIndex((item) => item.id === contentView);
  const previousContentView = CONTENT_VIEWS[Math.max(0, contentViewIndex - 1)]?.id ?? 'overview';
  const nextContentView =
    CONTENT_VIEWS[Math.min(CONTENT_VIEWS.length - 1, contentViewIndex + 1)]?.id ?? 'table';
  const isExecutiveView = contentView === 'fiscal' || contentView === 'payroll';

  const kpis = [
    { label: 'Dotação inicial', value: formatMoney(totals.initialBudget) },
    { label: 'Dotação atualizada', value: formatMoney(totals.updatedBudget) },
    { label: 'Empenhado', value: formatMoney(totals.committed) },
    { label: 'Liquidado', value: formatMoney(totals.liquidated) },
    { label: 'Pago', value: formatMoney(totals.paid) },
    {
      label: 'Execução',
      value: `${rate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    },
  ];

  return (
    <div className="orcamento-page-root h-svh w-full overflow-hidden bg-background">
      <div
        className="orcamento-zoom-shell flex flex-col overflow-hidden bg-background"
        style={{
          width: `${100 / PAGE_ZOOM}%`,
          height: `${100 / PAGE_ZOOM}%`,
          transform: `scale(${PAGE_ZOOM})`,
          transformOrigin: 'top left',
        }}
      >
      <header className="orcamento-app-header sticky top-0 z-30 shrink-0 border-b border-black bg-green-900 text-white">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="h-8 w-auto shrink-0" />
            <span className="hidden text-xl font-semibold uppercase tracking-widest text-primary-foreground/50 select-none lg:inline">
              |
            </span>
            <span className="truncate font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>
              Execução Orçamentária
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ExerciseSelect
              exercises={metadata?.exercises ?? []}
              year={loadedYear ?? year}
              onChange={changeYear}
              disabled={isLoading}
            />
            <Button
              variant="secondary"
              className="hidden rounded-sm border-black/50 bg-white text-foreground shadow-none hover:bg-stone-100 lg:inline-flex"
              onClick={() => router.push('/seplan')}
            >
              <BanknoteIcon data-icon="inline-start" />
              Orçamentos Temáticos
            </Button>
            <Button
              variant="secondary"
              className="rounded-sm border-black/50 bg-white text-foreground shadow-none hover:bg-stone-100"
              onClick={() => void load()}
              disabled={isLoading}
            >
              <RefreshCwIcon data-icon="inline-start" className={cn(isLoading && 'animate-spin')} />
              <span className="hidden lg:inline">Atualizar</span>
            </Button>
            <Button
              variant="secondary"
              className="rounded-sm border-black/50 bg-white text-foreground shadow-none hover:bg-stone-100"
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
        Layout em três colunas a partir de `xl`: trilha das visões à esquerda, conteúdo
        (KPIs, filtros e gráficos) no meio e a ótica dos dados à direita. As trilhas são
        fixas ao rolar para ficarem sempre alcançáveis sem cobrir o conteúdo. Abaixo de
        `xl` elas voltam a ser faixas horizontais acima do conteúdo.
      */}
      <main className="orcamento-main flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto p-3 xl:flex-row xl:items-stretch xl:gap-3 xl:overflow-hidden xl:p-3">
        {/* Trilha esquerda — ótica dos dados, filtros e visões */}
        {!isExecutiveView ? (
        <div
          className={cn(
            'orcamento-sidebar',
            'flex shrink-0 flex-col overflow-hidden border border-black/70 bg-white transition-[width] duration-300 ease-out',
            sidebarCollapsed ? 'xl:w-16' : 'xl:w-64',
            // No desktop, a trilha ocupa a altura disponível e rola internamente,
            // sem provocar scroll no documento.
            'xl:h-full xl:min-h-0 xl:overflow-hidden',
          )}
        >
          <div
            className={cn(
              'shrink-0 bg-green-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white',
              sidebarCollapsed && 'xl:hidden',
            )}
          >
            Filtros da execução
          </div>
          <div
            className={cn(
              'flex shrink-0 flex-col gap-1.5 border-b border-black/30 bg-white p-3',
              sidebarCollapsed && 'xl:hidden',
            )}
          >
            <label htmlFor="execution-metric" className="text-xs font-medium text-muted-foreground">
              Exibir valores de
            </label>
            <Select value={metric} onValueChange={(value) => setMetric(value as ExecutionMetric)}>
              <SelectTrigger
                id="execution-metric"
                className="w-full"
                aria-label="Estágio da despesa exibido nos gráficos"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {EXECUTION_METRICS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {EXECUTION_METRIC_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtros */}
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-b border-black/30 bg-white p-3',
              sidebarCollapsed && 'xl:hidden',
            )}
          >
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Buscar</FieldLabel>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ação, programa…"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Órgão</FieldLabel>
              <SearchableCombobox
                className="relative w-full min-w-0"
                value={organizationCode}
                onChange={(value) => {
                  setOrganizationCode(value);
                  setUnitFilter(allValue);
                  setSourceFilter(allValue);
                }}
                placeholder="Todos os órgãos"
                items={organizationOptions}
              />
            </Field>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Unidade</FieldLabel>
              <SearchableCombobox
                className="relative w-full min-w-0"
                value={unitFilter}
                onChange={(value) => {
                  setUnitFilter(value);
                  setSourceFilter(allValue);
                }}
                placeholder="Todas as unidades"
                items={unitOptions}
              />
            </Field>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Fonte de recurso</FieldLabel>
              <SearchableCombobox
                className="relative w-full min-w-0"
                value={sourceFilter}
                onChange={setSourceFilter}
                placeholder="Todas as fontes"
                items={sourceOptions}
              />
            </Field>
            <FunctionalClassificationFilters
              actions={actions}
              functionFilter={functionFilter}
              subfunctionFilter={subfunctionFilter}
              onFunctionChange={setFunctionFilter}
              onSubfunctionChange={setSubfunctionFilter}
              allValue={allValue}
            />
            {/*
              Sempre presente para o bloco não mudar de altura ao filtrar; fica
              desabilitado quando não há nada a limpar.
            */}
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Limpar filtros
            </Button>
          </div>

          {/* Visões — abaixo dos filtros e do seletor */}
          {contentView !== 'actions' ? (
            <nav
              className="shrink-0 bg-white"
              aria-label="Visões da execução orçamentária"
            >
              <div
                className={cn(
                  'border-b border-black/30 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
                  sidebarCollapsed && 'xl:sr-only',
                )}
              >
                Dimensão de análise
              </div>
              <ExecutionViewNavigation
                activeView={view}
                collapsed={sidebarCollapsed}
                onSelect={(selectedView) => {
                  setView(selectedView);
                  setContentView('overview');
                }}
              />
            </nav>
          ) : null}
        </div>
        ) : null}

        {/* Coluna central — conteúdo */}
        <div className="orcamento-content-column flex min-h-0 min-w-0 flex-1 flex-col gap-2 xl:h-full xl:overflow-hidden">
        {!isExecutiveView ? (
        <div className="orcamento-page-heading flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/70 pb-2">
          <Button
            variant="outline"
            size="icon"
            className="hidden shrink-0 self-center rounded-sm border-black/60 shadow-none xl:inline-flex"
            aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            title={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
          <h1 className="font-heading text-xl font-bold tracking-tight">Monitoramento da execução orçamentária</h1>
          <p className="border-l border-black/40 pl-3 text-sm text-muted-foreground">
            {isLoading
              ? 'Carregando dados do QDD vigente…'
              : `${filteredActions.length.toLocaleString('pt-BR')} ação(ões)`}
          </p>
        </div>
        ) : null}

        {/* Totais */}
        {/*
          Seis colunas só a partir de `2xl`: com a trilha lateral ocupando espaço, em
          1440px cada célula ficaria com ~147px e os valores (que precisam de ~170px)
          apareceriam cortados.
        */}
        {!isExecutiveView ? (
        <dl className="orcamento-global-kpis grid grid-cols-2 overflow-hidden border border-black/70 bg-white lg:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="min-w-0 border-b border-r border-black/20 px-3 py-2.5 last:border-r-0 2xl:border-b-0"
            >
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {kpi.label}
                </dt>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <dd className="mt-1 truncate text-base font-bold tabular-nums" title={kpi.value}>
                    {kpi.value}
                  </dd>
                )}
            </div>
          ))}
        </dl>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <Tabs
            value={contentView}
            onValueChange={(value) => setContentView(value as ContentView)}
            className="min-h-0 flex-1 overflow-hidden"
            role="group"
            aria-label="Visualização da execução — use as setas do teclado para alternar entre Visão geral, Órgão, Ações, Tabela e Folha de pagamento"
          >
            <TabsContent value="overview" forceMount className="min-h-0 overflow-hidden">
              <Tabs value={view} className="h-full min-h-0 flex-1 overflow-hidden">
                <TabsContent value="geral" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <CycleStackedBarChart
                      title="Ciclo da despesa por elemento"
                      description="Dotação atualizada dividida em não empenhado, empenhado não liquidado, liquidado não pago e pago."
                      rows={elementRows}
                    />
                    <CycleLineChart
                      title="Curva do ciclo — grupos de natureza"
                      description="Top 8 grupos de natureza pelo orçamento atualizado, ao longo dos 5 estágios da despesa."
                      rows={groupRows}
                    />
                    <ExecutionChartCard
                      title="Por categoria econômica"
                      rows={categoryRows}
                      metric={metric}
                      color={chartColors.category}
                    />
                    <ExecutionChartCard
                      title="Por modalidade de aplicação"
                      rows={modalityRows}
                      metric={metric}
                      color={chartColors.modality}
                    />
                    <ExecutionScatterChart
                      title="Dotação × execução por órgão"
                      description="Cada bolha é um órgão: eixo X = dotação atualizada, eixo Y = % liquidado, tamanho = pago."
                      rows={organizationRows}
                    />
                    <CycleStackedBarChart
                      title="Ciclo da despesa por fonte"
                      description="Top fontes de recurso pelo orçamento atualizado, com o percurso da execução."
                      rows={sourceRows}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="amendments" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <ExecutionChartCard title="Emendas por órgão" rows={amendmentOrganizationRows} metric={metric} color={chartColors.amendmentOrganization} />
                    <ExecutionChartCard title="Emendas por ação" rows={amendmentRows} metric={metric} color={chartColors.amendmentAction} />
                    <ExecutionChartCard title="Emendas por elemento" rows={amendmentElementRows} metric={metric} color={chartColors.amendmentElement} />
                    <ExecutionChartCard title="Emendas por fonte" rows={amendmentSourceRows} metric={metric} color={chartColors.amendmentSource} />
                    <ExecutionChartCard title="Emendas por grupo de natureza" rows={amendmentGroupRows} metric={metric} color={chartColors.amendmentGroup} />
                    <ExecutionChartCard title="Emendas por categoria econômica" rows={amendmentCategoryRows} metric={metric} color={chartColors.amendmentCategory} />
                  </div>
                </TabsContent>

              </Tabs>
            </TabsContent>

            <TabsContent value="fiscal" forceMount className="h-full min-h-0 overflow-hidden">
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
                onOrganizationChange={(value) => {
                  setOrganizationCode(value);
                  setUnitFilter(allValue);
                  setSourceFilter(allValue);
                }}
                onUnitChange={(value) => {
                  setUnitFilter(value);
                  setSourceFilter(allValue);
                }}
                vigenteImport={metadata?.vigenteImport}
              />
            </TabsContent>

            <TabsContent value="actions" forceMount className="h-full min-h-0 overflow-hidden">
              <OverviewScheduledActionsPanel
                actions={filteredActions}
                organizations={organizations}
                variant="execution"
                executionMetric={metric}
              />
            </TabsContent>

            <TabsContent value="table" forceMount className="min-h-0 overflow-hidden">
              <Tabs value={view} className="h-full min-h-0 flex-1 overflow-hidden">
                {/*
                  As tabelas, diferente dos gráficos, não eram redundantes entre as
                  antigas dimensões — cada uma trazia um recorte próprio. Ao fundir as
                  dimensões, todas passam a conviver aqui, empilhadas com rolagem.

                  STACKED_TABLE_CLASS é essencial: sem shrink-0 os cards, sendo itens
                  flex com min-h-0, encolhiam até sobrar só uma linha visível em cada.
                */}
                <TabsContent
                  value="geral"
                  forceMount
                  className="flex min-h-0 flex-col gap-2 overflow-y-auto"
                >
                  <ExecutionTablePanel
                    title="Execução por elemento de despesa"
                    description="Elemento é a 4ª posição do código da natureza da despesa (ex.: 3 1 90 13 → elemento 13). Valores somados das linhas de despesa do QDD vigente."
                    rows={elementRows}
                    metric={metric}
                    entityLabel="Elemento de despesa"
                    countLabel="Linhas"
                    className={STACKED_TABLE_CLASS}
                  />
                  <ExecutionTablePanel
                    title="Execução por grupo de natureza"
                    description="Visão mais agregada: pessoal, outras despesas correntes, investimentos, dívida."
                    rows={groupRows}
                    metric={metric}
                    entityLabel="Grupo de natureza"
                    countLabel="Linhas"
                    className={STACKED_TABLE_CLASS}
                  />
                  <ExecutionTablePanel
                    title="Execução por ação orçamentária"
                    description="Cada ação do QDD (projeto/atividade + aplicação programada), ordenada pelo valor selecionado."
                    rows={actionRows}
                    metric={metric}
                    entityLabel="Ação orçamentária"
                    countLabel="Ações"
                    className={STACKED_TABLE_CLASS}
                  />
                  <ExecutionTablePanel
                    title="Execução por fonte de recurso"
                    description="Fonte/destinação de recursos conforme o anexo da SEPLAN para o exercício vigente."
                    rows={sourceRows}
                    metric={metric}
                    entityLabel="Fonte de recurso"
                    countLabel="Linhas"
                    className={STACKED_TABLE_CLASS}
                  />
                </TabsContent>

                <TabsContent value="amendments" forceMount className="grid min-h-0 grid-rows-2 gap-2 overflow-hidden">
                  <ExecutionTablePanel
                    title="Emendas por órgão"
                    description={`${amendmentCount.toLocaleString('pt-BR')} ação(ões) identificadas como emenda — projeto/atividade iniciado em 8, exceto os códigos de controle da dívida.`}
                    rows={amendmentOrganizationRows}
                    metric={metric}
                    entityLabel="Órgão"
                    countLabel="Ações"
                    className="min-h-0 overflow-hidden"
                  />
                  <ExecutionTablePanel
                    title="Emendas por ação"
                    description="Detalhamento de cada ação classificada como emenda parlamentar."
                    rows={amendmentRows}
                    metric={metric}
                    entityLabel="Ação (emenda)"
                    countLabel="Ações"
                    className="min-h-0 overflow-hidden"
                  />
                </TabsContent>

              </Tabs>
            </TabsContent>

            {/*
              Folha de pagamento: dado externo (Portal da Transparência), coletado por
              job diário e lido do banco — não depende dos filtros do QDD, que são de
              orçamento e não se aplicam a servidores.
            */}
            <TabsContent value="payroll" forceMount className="h-full min-h-0 overflow-hidden">
              {payroll ? (
                <PayrollPanel data={payroll} />
              ) : (
                <Skeleton className="h-96 w-full" />
              )}
            </TabsContent>

          </Tabs>
        )}
        </div>
        </main>
        <div className="orcamento-view-footer z-10 flex min-h-11 shrink-0 items-stretch justify-between border-t border-black/70 bg-white">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Visualização anterior"
            aria-disabled={contentViewIndex === 0}
            className={cn(
              'h-auto rounded-none border-r border-black/20 px-3 shadow-none',
              contentViewIndex === 0 && 'pointer-events-none opacity-40',
            )}
            onClick={() => setContentView(previousContentView)}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          {/*
            Mesma animação das abas dos orçamentos temáticos: uma faixa verde desliza
            até o item sob o mouse e volta para o ativo ao sair da lista. A cor do
            item ativo vem da faixa, não de um fundo próprio — por isso aqui os
            botões só controlam a borda e a cor do texto.
          */}
          <div
            ref={contentViewPill.listRef}
            className="relative flex min-w-0 items-stretch overflow-x-auto"
            role="tablist"
            aria-label="Visualizações da execução"
            onMouseLeave={contentViewPill.resetHighlight}
          >
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 z-0 bg-green-900',
                'transition-[left,width] duration-500 ease-out',
                contentViewPill.pill.ready ? 'opacity-100' : 'opacity-0',
              )}
              style={{ left: contentViewPill.pill.left, width: contentViewPill.pill.width }}
            />
            {/*
              Marcador da aba selecionada, em creme. Fica acima da faixa (z-20) para
              continuar visível quando ela estiver por cima — se fosse verde sobre
              verde, sumiria justamente na aba ativa. O tom acompanha os bege da
              paleta usada nos gráficos da folha de pagamento.
            */}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute bottom-0 z-20 h-[3px] bg-[#b8b477]',
                'transition-[left,width] duration-300 ease-out',
                contentViewPill.activePill.ready ? 'opacity-100' : 'opacity-0',
              )}
              style={{
                left: contentViewPill.activePill.left,
                width: contentViewPill.activePill.width,
              }}
            />
            {CONTENT_VIEWS.map((item) => {
              const active = contentView === item.id;
              const highlighted = contentViewPill.highlightValue === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={item.label}
                  data-hover-tab-value={item.id}
                  onClick={() => setContentView(item.id)}
                  onFocus={() => contentViewPill.highlight(item.id)}
                  onMouseEnter={() => contentViewPill.highlight(item.id)}
                  className={cn(
                    // A borda de baixo continua aqui só como reserva de espaço: o
                    // marcador visível é o retângulo deslizante acima.
                    'relative z-10 shrink-0 border-b-[3px] border-transparent px-4 py-2 text-xs font-semibold transition-colors',
                    highlighted ? 'text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Próxima visualização"
            aria-disabled={contentViewIndex === CONTENT_VIEWS.length - 1}
            className={cn(
              'h-auto rounded-none border-l border-black/20 px-3 shadow-none',
              contentViewIndex === CONTENT_VIEWS.length - 1 && 'pointer-events-none opacity-40',
            )}
            onClick={() => setContentView(nextContentView)}
          >
            <span className="hidden sm:inline">Próximo</span>
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
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
