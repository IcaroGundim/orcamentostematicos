'use client';

import {
  BanknoteIcon,
  BarChart3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  LandmarkIcon,
  LogOutIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SearchIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ExecutionChartCard,
  ExecutionTablePanel,
} from '@/components/domain/execution-breakdown-panel';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { OverviewScheduledActionsPanel } from '@/components/domain/overview-scheduled-actions-panel';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
  executionRate,
  totalsOf,
} from '@/lib/execution-monitor';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { cn } from '@/lib/utils';
import type { BudgetAction, Organization } from '@/types/domain';

const allValue = 'ALL';
const PAGE_ZOOM = 0.95;

/**
 * Grade dos gráficos: 3 colunas × 2 linhas a partir de `xl`. Abaixo disso degrada
 * para 2 colunas e depois 1, porque uma célula de gráfico com eixo de categorias
 * fica ilegível em menos de ~330px.
 */
const gridClass =
  'grid h-full min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2';

type ViewId = 'element' | 'action' | 'amendments' | 'source';
type ContentView = 'overview' | 'actions' | 'table';

const VIEWS: { id: ViewId; label: string; icon: typeof BarChart3Icon }[] = [
  { id: 'element', label: 'Elemento de despesa', icon: CoinsIcon },
  { id: 'action', label: 'Ação orçamentária', icon: BarChart3Icon },
  { id: 'amendments', label: 'Emendas parlamentares', icon: ScrollTextIcon },
  { id: 'source', label: 'Fonte de recurso', icon: LandmarkIcon },
];

const CONTENT_VIEWS: { id: ContentView; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'actions', label: 'Ações' },
  { id: 'table', label: 'Tabela' },
];

function ExecutionViewNavigation({
  activeView,
  onSelect,
}: {
  activeView: ViewId;
  onSelect: (view: ViewId) => void;
}) {
  const navigationRef = useRef<HTMLDivElement>(null);
  const activeViewRef = useRef(activeView);
  const highlightedViewRef = useRef(activeView);
  const [highlightedView, setHighlightedView] = useState(activeView);
  const [highlight, setHighlight] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updateHighlight = useCallback((view: ViewId) => {
    const navigation = navigationRef.current;
    const target = navigation?.querySelector<HTMLElement>(`[data-execution-view="${view}"]`);
    if (!navigation || !target) return;
    setHighlight({
      top: target.offsetTop,
      left: target.offsetLeft,
      width: target.offsetWidth,
      height: target.offsetHeight,
      ready: true,
    });
  }, []);

  const highlightView = useCallback(
    (view: ViewId) => {
      highlightedViewRef.current = view;
      setHighlightedView(view);
      updateHighlight(view);
    },
    [updateHighlight],
  );

  useLayoutEffect(() => {
    activeViewRef.current = activeView;
    highlightedViewRef.current = activeView;
    setHighlightedView(activeView);
    updateHighlight(activeView);
  }, [activeView, updateHighlight]);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const onResize = () => updateHighlight(highlightedViewRef.current);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(navigation);
    window.addEventListener('resize', onResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [updateHighlight]);

  return (
    <div
      ref={navigationRef}
      className="relative flex flex-wrap gap-2 xl:flex-col"
      role="tablist"
      onMouseLeave={() => highlightView(activeViewRef.current)}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-0 rounded-lg bg-primary shadow-sm',
          'transition-[top,left,width,height] duration-300 ease-out',
          highlight.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: highlight.top,
          left: highlight.left,
          width: highlight.width,
          height: highlight.height,
        }}
      />

      {VIEWS.map((item) => {
        const Icon = item.icon;
        const highlighted = highlightedView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeView === item.id}
            data-execution-view={item.id}
            onClick={() => onSelect(item.id)}
            onFocus={() => highlightView(item.id)}
            onMouseEnter={() => highlightView(item.id)}
            className={cn(
              'relative z-10 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-none',
              'xl:w-full xl:justify-start',
              highlighted
                ? 'border-transparent bg-transparent text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="text-left leading-tight">{item.label}</span>
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

export default function OrcamentoPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [view, setView] = useState<ViewId>('element');
  const [contentView, setContentView] = useState<ContentView>('overview');
  const [metric, setMetric] = useState<ExecutionMetric>('liquidated');

  const [organizationCode, setOrganizationCode] = useState(allValue);
  const [functionFilter, setFunctionFilter] = useState(allValue);
  const [subfunctionFilter, setSubfunctionFilter] = useState(allValue);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedActions, loadedOrganizations] = await Promise.all([
        api<BudgetAction[]>('/budget-actions'),
        api<Organization[]>('/organizations'),
      ]);
      setActions(loadedActions);
      setOrganizations(loadedOrganizations);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    load().catch((error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao carregar os dados da execução orçamentária.',
      );
    });
  }, [router, load]);

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

  const organizationOptions = useMemo(
    () => [
      { value: allValue, label: 'Todos os órgãos' },
      ...organizations.map((organization) => ({
        value: organization.code,
        label: `${organization.code} — ${organization.name}`,
      })),
    ],
    [organizations],
  );

  const filteredActions = useMemo(() => {
    const term = normalize(search.trim());
    return actions.filter((action) => {
      if (organizationCode !== allValue && action.organizationCode !== organizationCode) return false;
      if (!actionMatchesFunctionalFilters(action, functionFilter, subfunctionFilter, allValue)) return false;
      if (!term) return true;
      return (
        normalize(action.application).includes(term) ||
        normalize(action.projectActivity).includes(term) ||
        normalize(action.functionalProgram).includes(term) ||
        normalize(action.organizationName).includes(term)
      );
    });
  }, [actions, organizationCode, functionFilter, subfunctionFilter, search]);

  const totals = useMemo(() => totalsOf(filteredActions), [filteredActions]);

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
    functionFilter !== allValue ||
    subfunctionFilter !== allValue ||
    search.trim() !== '';

  function clearFilters() {
    setOrganizationCode(allValue);
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
    <div className="h-svh w-full overflow-hidden bg-background">
      <div
        className="flex flex-col overflow-hidden bg-background"
        style={{
          width: `${100 / PAGE_ZOOM}%`,
          height: `${100 / PAGE_ZOOM}%`,
          transform: `scale(${PAGE_ZOOM})`,
          transformOrigin: 'top left',
        }}
      >
      <header className="sticky top-0 z-30 shrink-0 border-b border-black bg-green-900 text-white shadow-sm">
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
            <Button
              variant="secondary"
              className="hidden border-border/60 bg-white text-foreground hover:bg-white/90 lg:inline-flex"
              onClick={() => router.push('/seplan')}
            >
              <BanknoteIcon data-icon="inline-start" />
              Orçamentos Temáticos
            </Button>
            <Button
              variant="secondary"
              className="border-border/60 bg-white text-foreground hover:bg-white/90"
              onClick={() => void load()}
              disabled={isLoading}
            >
              <RefreshCwIcon data-icon="inline-start" className={cn(isLoading && 'animate-spin')} />
              <span className="hidden lg:inline">Atualizar</span>
            </Button>
            <Button
              variant="secondary"
              className="border-border/60 bg-white text-foreground hover:bg-white/90"
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
      <main className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto p-4 xl:flex-row xl:items-stretch xl:gap-4 xl:overflow-hidden xl:p-4">
        {/* Trilha esquerda — ótica dos dados, filtros e visões */}
        <div
          className={cn(
            'flex shrink-0 flex-col gap-3 xl:w-64',
            // No desktop, a trilha ocupa a altura disponível e rola internamente,
            // sem provocar scroll no documento.
            'xl:h-full xl:min-h-0 xl:overflow-hidden',
          )}
        >
          <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
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
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
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
                onChange={setOrganizationCode}
                placeholder="Todos os órgãos"
                items={organizationOptions}
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
            <nav aria-label="Visões da execução orçamentária">
              <ExecutionViewNavigation
                activeView={view}
                onSelect={(selectedView) => {
                  setView(selectedView);
                  setContentView('overview');
                }}
              />
            </nav>
          ) : null}
        </div>

        {/* Coluna central — conteúdo */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:h-full xl:overflow-hidden">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-xl font-semibold">Monitoramento da execução orçamentária</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Carregando dados do QDD vigente…'
              : `${filteredActions.length.toLocaleString('pt-BR')} ação(ões)`}
          </p>
        </div>

        {/* Totais */}
        {/*
          Seis colunas só a partir de `2xl`: com a trilha lateral ocupando espaço, em
          1440px cada célula ficaria com ~147px e os valores (que precisam de ~170px)
          apareceriam cortados.
        */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label} size="sm">
              <CardContent className="flex flex-col gap-1 py-1">
                <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </span>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="truncate text-base font-semibold tabular-nums">{kpi.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <Tabs
            value={contentView}
            onValueChange={(value) => setContentView(value as ContentView)}
            className="min-h-0 flex-1 overflow-hidden"
            role="group"
            aria-label="Visualização da execução — use as setas do teclado para alternar entre Visão geral, Ações e Tabela"
          >
            <TabsContent value="overview" forceMount className="min-h-0 overflow-hidden">
              <Tabs value={view} className="h-full min-h-0 flex-1 overflow-hidden">
                <TabsContent value="element" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <ExecutionChartCard title="Por elemento de despesa" rows={elementRows} metric={metric} />
                    <ExecutionChartCard title="Por grupo de natureza" rows={groupRows} metric={metric} />
                    <ExecutionChartCard title="Por categoria econômica" rows={categoryRows} metric={metric} />
                    <ExecutionChartCard title="Por modalidade de aplicação" rows={modalityRows} metric={metric} />
                    <ExecutionChartCard title="Por órgão" rows={organizationRows} metric={metric} />
                    <ExecutionChartCard title="Por fonte de recurso" rows={sourceRows} metric={metric} />
                  </div>
                </TabsContent>

                <TabsContent value="action" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <ExecutionChartCard title="Por ação orçamentária" rows={actionRows} metric={metric} />
                    <ExecutionChartCard title="Por órgão" rows={organizationRows} metric={metric} />
                    <ExecutionChartCard title="Por elemento de despesa" rows={elementRows} metric={metric} />
                    <ExecutionChartCard title="Por fonte de recurso" rows={sourceRows} metric={metric} />
                    <ExecutionChartCard title="Por grupo de natureza" rows={groupRows} metric={metric} />
                    <ExecutionChartCard title="Por modalidade de aplicação" rows={modalityRows} metric={metric} />
                  </div>
                </TabsContent>

                <TabsContent value="amendments" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <ExecutionChartCard title="Emendas por órgão" rows={amendmentOrganizationRows} metric={metric} />
                    <ExecutionChartCard title="Emendas por ação" rows={amendmentRows} metric={metric} />
                    <ExecutionChartCard title="Emendas por elemento" rows={amendmentElementRows} metric={metric} />
                    <ExecutionChartCard title="Emendas por fonte" rows={amendmentSourceRows} metric={metric} />
                    <ExecutionChartCard title="Emendas por grupo de natureza" rows={amendmentGroupRows} metric={metric} />
                    <ExecutionChartCard title="Emendas por categoria econômica" rows={amendmentCategoryRows} metric={metric} />
                  </div>
                </TabsContent>

                <TabsContent value="source" forceMount className="min-h-0 overflow-hidden">
                  <div className={gridClass}>
                    <ExecutionChartCard title="Por fonte de recurso" rows={sourceRows} metric={metric} />
                    <ExecutionChartCard title="Por órgão" rows={organizationRows} metric={metric} />
                    <ExecutionChartCard title="Por elemento de despesa" rows={elementRows} metric={metric} />
                    <ExecutionChartCard title="Por grupo de natureza" rows={groupRows} metric={metric} />
                    <ExecutionChartCard title="Por categoria econômica" rows={categoryRows} metric={metric} />
                    <ExecutionChartCard title="Por modalidade de aplicação" rows={modalityRows} metric={metric} />
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="actions" forceMount className="h-full min-h-0 overflow-hidden">
              <OverviewScheduledActionsPanel
                actions={filteredActions}
                organizations={organizations}
                variant="execution"
              />
            </TabsContent>

            <TabsContent value="table" forceMount className="min-h-0 overflow-hidden">
              <Tabs value={view} className="h-full min-h-0 flex-1 overflow-hidden">
                <TabsContent value="element" forceMount className="grid min-h-0 grid-rows-2 gap-3 overflow-hidden">
                  <ExecutionTablePanel
                    title="Execução por elemento de despesa"
                    description="Elemento é a 4ª posição do código da natureza da despesa (ex.: 3 1 90 13 → elemento 13). Valores somados das linhas de despesa do QDD vigente."
                    rows={elementRows}
                    metric={metric}
                    entityLabel="Elemento de despesa"
                    countLabel="Linhas"
                    className="min-h-0 overflow-hidden"
                  />
                  <ExecutionTablePanel
                    title="Execução por grupo de natureza"
                    description="Visão mais agregada: pessoal, outras despesas correntes, investimentos, dívida."
                    rows={groupRows}
                    metric={metric}
                    entityLabel="Grupo de natureza"
                    countLabel="Linhas"
                    className="min-h-0 overflow-hidden"
                  />
                </TabsContent>

                <TabsContent value="action" forceMount className="min-h-0 overflow-hidden">
                  <ExecutionTablePanel
                    title="Execução por ação orçamentária"
                    description="Cada ação do QDD (projeto/atividade + aplicação programada), ordenada pelo valor selecionado."
                    rows={actionRows}
                    metric={metric}
                    entityLabel="Ação orçamentária"
                    countLabel="Ações"
                    className="h-full min-h-0 overflow-hidden"
                  />
                </TabsContent>

                <TabsContent value="amendments" forceMount className="grid min-h-0 grid-rows-2 gap-3 overflow-hidden">
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

                <TabsContent value="source" forceMount className="min-h-0 overflow-hidden">
                  <ExecutionTablePanel
                    title="Execução por fonte de recurso"
                    description="Fonte/destinação de recursos conforme o anexo da SEPLAN para o exercício vigente."
                    rows={sourceRows}
                    metric={metric}
                    entityLabel="Fonte de recurso"
                    countLabel="Linhas"
                    className="h-full min-h-0 overflow-hidden"
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <div className="z-10 mt-1 flex shrink-0 items-center justify-between gap-2 border-t bg-background/95 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                aria-label="Visualização anterior"
                aria-disabled={contentViewIndex === 0}
                className={cn(contentViewIndex === 0 && 'pointer-events-none opacity-40')}
                onClick={() => setContentView(previousContentView)}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              <div
                className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2"
                role="tablist"
                aria-label="Visualizações da execução"
              >
                {CONTENT_VIEWS.map((item) => {
                  const active = contentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={item.label}
                      onClick={() => setContentView(item.id)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 ease-out',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <Button
                size="sm"
                aria-label="Próxima visualização"
                aria-disabled={contentViewIndex === CONTENT_VIEWS.length - 1}
                className={cn(
                  contentViewIndex === CONTENT_VIEWS.length - 1 && 'pointer-events-none opacity-40',
                )}
                onClick={() => setContentView(nextContentView)}
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </Tabs>
        )}
        </div>
        </main>
      </div>
    </div>
  );
}
