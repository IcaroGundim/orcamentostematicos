'use client';

import {
  BanknoteIcon,
  BarChart3Icon,
  CoinsIcon,
  LandmarkIcon,
  LogOutIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SearchIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExecutionBreakdownPanel } from '@/components/domain/execution-breakdown-panel';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { api, clearStoredSession, formatMoney, getStoredSession, type Session } from '@/lib/api';
import {
  aggregateAmendments,
  aggregateAmendmentsByType,
  aggregateByAction,
  aggregateByElement,
  aggregateByGroup,
  aggregateByOrganization,
  aggregateBySource,
  amendmentActions,
  executionRate,
  totalsOf,
} from '@/lib/execution-monitor';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { cn } from '@/lib/utils';
import type { BudgetAction, Metadata, Organization } from '@/types/domain';

const allValue = 'ALL';

type ViewId = 'element' | 'action' | 'amendments' | 'source';

const VIEWS: { id: ViewId; label: string; icon: typeof BarChart3Icon }[] = [
  { id: 'element', label: 'Elemento de despesa', icon: CoinsIcon },
  { id: 'action', label: 'Ação orçamentária', icon: BarChart3Icon },
  { id: 'amendments', label: 'Emendas parlamentares', icon: ScrollTextIcon },
  { id: 'source', label: 'Fonte de recurso', icon: LandmarkIcon },
];

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
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [view, setView] = useState<ViewId>('element');

  const [organizationCode, setOrganizationCode] = useState(allValue);
  const [functionFilter, setFunctionFilter] = useState(allValue);
  const [subfunctionFilter, setSubfunctionFilter] = useState(allValue);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedActions, loadedOrganizations, loadedMetadata] = await Promise.all([
        api<BudgetAction[]>('/budget-actions'),
        api<Organization[]>('/organizations'),
        api<Metadata>('/metadata'),
      ]);
      setActions(loadedActions);
      setOrganizations(loadedOrganizations);
      setMetadata(loadedMetadata);
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
  const elementRows = useMemo(() => aggregateByElement(filteredActions), [filteredActions]);
  const groupRows = useMemo(() => aggregateByGroup(filteredActions), [filteredActions]);
  const actionRows = useMemo(() => aggregateByAction(filteredActions), [filteredActions]);
  const amendmentRows = useMemo(() => aggregateAmendments(filteredActions), [filteredActions]);
  const amendmentTypeRows = useMemo(() => aggregateAmendmentsByType(filteredActions), [filteredActions]);
  const amendmentOrganizationRows = useMemo(
    () => aggregateByOrganization(amendmentActions(filteredActions)),
    [filteredActions],
  );
  const sourceRows = useMemo(() => aggregateBySource(filteredActions), [filteredActions]);
  const amendmentCount = useMemo(() => amendmentActions(filteredActions).length, [filteredActions]);

  const expenseLineCount = useMemo(
    () =>
      filteredActions.reduce(
        (total, action) => total + (action.expenseLinesCount ?? action.expenseLines?.length ?? 0),
        0,
      ),
    [filteredActions],
  );

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
    <div className="flex min-h-svh flex-col bg-background">
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

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="font-heading text-xl font-semibold">Monitoramento da execução orçamentária</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Carregando dados do QDD vigente…'
                : `${filteredActions.length.toLocaleString('pt-BR')} ação(ões) · ${expenseLineCount.toLocaleString('pt-BR')} linha(s) de despesa`}
              {metadata?.vigenteImport
                ? ` · exercício ${metadata.vigenteImport.year}`
                : ''}
            </p>
          </div>
          {hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Buscar</FieldLabel>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ação, programa, órgão…"
                  className="pl-8"
                />
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Totais */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
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

        {/* Visões */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Visões da execução orçamentária">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Tabs value={view} className="min-h-0 flex-1">
            <TabsContent value="element" forceMount className="flex flex-col gap-5">
              <ExecutionBreakdownPanel
                title="Execução por elemento de despesa"
                description="Elemento é a 4ª posição do código da natureza da despesa (ex.: 3 1 90 13 → elemento 13). Valores somados das linhas de despesa do QDD vigente."
                rows={elementRows}
                entityLabel="Elemento de despesa"
                countLabel="Linhas"
              />
              <ExecutionBreakdownPanel
                title="Execução por grupo de natureza"
                description="Visão mais agregada: pessoal, outras despesas correntes, investimentos, dívida."
                rows={groupRows}
                entityLabel="Grupo de natureza"
                countLabel="Linhas"
              />
            </TabsContent>

            <TabsContent value="action" forceMount>
              <ExecutionBreakdownPanel
                title="Execução por ação orçamentária"
                description="Cada ação do QDD (projeto/atividade + aplicação programada), ordenada pelo valor liquidado."
                rows={actionRows}
                entityLabel="Ação orçamentária"
                countLabel="Ações"
              />
            </TabsContent>

            <TabsContent value="amendments" forceMount className="flex flex-col gap-5">
              <ExecutionBreakdownPanel
                title="Emendas por órgão"
                description={`${amendmentCount.toLocaleString('pt-BR')} ação(ões) identificadas como emenda — projeto/atividade iniciado em 8, exceto os códigos de controle da dívida.`}
                rows={amendmentOrganizationRows}
                entityLabel="Órgão"
                countLabel="Ações"
              />
              {/*
                O tipo da emenda (individual/bancada/comissão/relator) só é dedutível
                pela fonte de recurso, e no QDD vigente todas as emendas são custeadas
                por fonte do tesouro estadual — que não declara o tipo. O painel só
                aparece se houver mais de um tipo, para não exibir uma linha única
                dizendo "não identificado".
              */}
              {amendmentTypeRows.length > 1 ? (
                <ExecutionBreakdownPanel
                  title="Emendas por tipo"
                  description="Tipo deduzido da fonte de recurso, conforme o catálogo de fontes da SEPLAN."
                  rows={amendmentTypeRows}
                  entityLabel="Tipo de emenda"
                  countLabel="Linhas"
                />
              ) : null}
              <ExecutionBreakdownPanel
                title="Emendas por ação"
                description="Detalhamento de cada ação classificada como emenda parlamentar."
                rows={amendmentRows}
                entityLabel="Ação (emenda)"
                countLabel="Ações"
              />
            </TabsContent>

            <TabsContent value="source" forceMount>
              <ExecutionBreakdownPanel
                title="Execução por fonte de recurso"
                description="Fonte/destinação de recursos conforme o anexo da SEPLAN para o exercício vigente."
                rows={sourceRows}
                entityLabel="Fonte de recurso"
                countLabel="Linhas"
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
