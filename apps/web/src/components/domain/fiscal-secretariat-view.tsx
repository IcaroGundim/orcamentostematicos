'use client';

import { useMemo, useRef } from 'react';
import {
  Building2Icon,
  CalendarDaysIcon,
  InfoIcon,
  Maximize2Icon,
  PrinterIcon,
  UsersIcon,
  WalletCardsIcon,
} from 'lucide-react';
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoney } from '@/lib/api';
import {
  aggregateByAction,
  aggregateByCategory,
  aggregateBySource,
  executionRate,
  isCentralPayrollAction,
  personnelTotalsOf,
  totalsOf,
  type ExecutionRow,
  type ExecutionTotals,
} from '@/lib/execution-monitor';
import { getFonteLabel } from '@/lib/fontes-recursos';
import { actionIsAmendment } from '@/lib/functional-classification';
import type { PayrollHeadcountScope } from '@/lib/payroll-scope';
import { cn } from '@/lib/utils';
import type { BudgetAction, BudgetImport, Organization } from '@/types/domain';

const FISCAL_COLORS = ['#5f8f70', '#8fa873', '#b8b477', '#110f24', '#c8c89f'] as const;
const UNRESTRICTED_TREASURY_SOURCE = '15000100';

/**
 * Fontes vinculadas que entram no Orçamento Comprometido de órgãos específicos, além
 * da Fonte 100.
 *
 * Alguns órgãos executam quase tudo por fontes vinculadas, e medir só pela fonte 100
 * descreveria uma fatia irrelevante do orçamento deles. A SESACRE, por exemplo, tem
 * ~R$ 28 mi na fonte 100 contra ~R$ 841 mi nas vinculadas da saúde — o indicador
 * marcava 10,7% quando o número real passa de 70%.
 *
 * A lista é por órgão de propósito, e não global: a 15001002 também aparece na SEAD
 * (~R$ 962 mi) e na SEFAZ (~R$ 41 mi), e a 17530700 no Meio Ambiente e nas polícias;
 * incluí-las lá alteraria indicadores sem relação com a finalidade da vinculação.
 */
const EARMARKED_SOURCES_BY_ORGANIZATION: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    // SESACRE — 12% constitucional da saúde e manutenção do SUS.
    '721': ['15001002', '16000400'],
    // SEJUSP — Fundo de Segurança Pública (inclusive superávit), taxas e preços
    // públicos e multas de trânsito.
    '719': ['17530700', '17130700', '27130700', '17520700'],
  });
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

type FiscalSecretariatViewProps = {
  actions: BudgetAction[];
  personnelActions: BudgetAction[];
  centralPayrollActions: BudgetAction[];
  personnelScopeLabel: string;
  personnelScopeNote: string;
  organization?: Organization;
  organizationCode: string;
  organizationOptions: SearchableComboboxItem[];
  unitFilter: string;
  unitOptions: SearchableComboboxItem[];
  payrollHeadcount: PayrollHeadcountScope | null;
  allValue: string;
  onOrganizationChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  vigenteImport?: BudgetImport | null;
};

type UnitRow = ExecutionTotals & {
  key: string;
  label: string;
  count: number;
};

function safeRate(value: number, base: number) {
  if (!base) return 0;
  return (value / base) * 100;
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} bi`;
  }
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mi`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 0,
    })} mil`;
  }
  return formatMoney(value);
}

function periodLabel(vigenteImport?: BudgetImport | null) {
  if (!vigenteImport) return 'Período de referência não informado';
  const month = MONTH_NAMES[vigenteImport.referenceMonth - 1] ?? '';
  const period =
    vigenteImport.periodType === 'ACUMULADO_ANUAL'
      ? `Acumulado até ${month}`
      : `Mês de ${month}`;
  return `${period} de ${vigenteImport.year}`;
}

function aggregateByUnit(actions: BudgetAction[]): UnitRow[] {
  const rows = new Map<string, UnitRow>();
  for (const action of actions) {
    const key = `${action.organizationCode}/${action.unitCode}`;
    const current = rows.get(key) ?? {
      key,
      label: `${action.unitCode} — ${action.unitName}`,
      count: 0,
      initialBudget: 0,
      updatedBudget: 0,
      committed: 0,
      liquidated: 0,
      paid: 0,
      available: 0,
    };
    current.count += 1;
    current.initialBudget += action.totals.initialBudget;
    current.updatedBudget += action.totals.updatedBudget;
    current.committed += action.totals.committed;
    current.liquidated += action.totals.liquidated;
    current.paid += action.totals.paid;
    current.available += action.totals.available;
    rows.set(key, current);
  }
  return [...rows.values()].sort((a, b) => b.updatedBudget - a.updatedBudget);
}

function MiniBarList({
  rows,
  valueKey = 'updatedBudget',
  emptyLabel,
  basisLabel = 'do total',
}: {
  rows: Array<ExecutionRow | UnitRow>;
  valueKey?: keyof ExecutionTotals;
  emptyLabel: string;
  basisLabel?: string;
}) {
  const positiveRows = rows.filter((row) => row[valueKey] > 0);
  const total = positiveRows.reduce((sum, row) => sum + row[valueKey], 0);
  const visibleRows = [...positiveRows]
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, 5);

  if (!visibleRows.length) {
    return (
      <div className="flex h-full min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="fiscal-bar-list grid min-w-0 gap-2.5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Participação na dotação atualizada total do recorte
        {positiveRows.length > visibleRows.length
          ? ` · exibindo os ${visibleRows.length} maiores de ${positiveRows.length}`
          : ''}
        .
      </p>
      {visibleRows.map((row, index) => {
        const value = row[valueKey];
        const share = total ? (value / total) * 100 : 0;
        return (
          <div key={row.key} className="fiscal-bar-row grid min-w-0 gap-1">
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {compactMoney(value)}
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div
                className="h-1.5 overflow-hidden bg-muted"
                role="img"
                aria-label={`${row.label}: ${formatPercent(share)} ${basisLabel}`}
              >
                <div
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(share > 0 ? 1 : 0, Math.min(100, share))}%`,
                    backgroundColor: FISCAL_COLORS[index % FISCAL_COLORS.length],
                  }}
                />
              </div>
              <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                {formatPercent(share)} {basisLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FiscalKpi({
  label,
  value,
  helpText,
}: {
  label: string;
  value: string;
  helpText?: string;
}) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{label}</span>
        {helpText ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="fiscal-kpi-help inline-flex shrink-0 text-green-900 hover:text-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-900"
                aria-label={`Como é calculado: ${label}`}
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {helpText}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </dt>
      <dd className="mt-1 truncate text-base font-bold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}

function FiscalSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-h-0 min-w-0 overflow-hidden border bg-white', className)}>
      <h3 className="bg-green-900 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </h3>
      <div className="min-h-0 min-w-0 overflow-hidden p-3">{children}</div>
    </section>
  );
}

export function FiscalSecretariatView({
  actions,
  personnelActions,
  centralPayrollActions,
  personnelScopeLabel,
  personnelScopeNote,
  organization,
  organizationCode,
  organizationOptions,
  unitFilter,
  unitOptions,
  payrollHeadcount,
  allValue,
  onOrganizationChange,
  onUnitChange,
  vigenteImport,
}: FiscalSecretariatViewProps) {
  const presentationRef = useRef<HTMLDivElement>(null);
  const totals = useMemo(() => totalsOf(actions), [actions]);
  const earmarkedSources = EARMARKED_SOURCES_BY_ORGANIZATION[organizationCode] ?? [];
  const commitmentSources = useMemo(
    () => [UNRESTRICTED_TREASURY_SOURCE, ...earmarkedSources],
    [earmarkedSources],
  );

  const commitmentTotals = useMemo(
    () =>
      actions
        .flatMap((action) => action.expenseLines ?? [])
        .filter((line) => commitmentSources.includes((line.source ?? '').replace(/\D/g, '')))
        .reduce(
          (sum, line) => ({
            updatedBudget: sum.updatedBudget + line.updatedBudget,
            committed: sum.committed + line.committed,
          }),
          { updatedBudget: 0, committed: 0 },
        ),
    [actions, commitmentSources],
  );
  const categoryRows = useMemo(() => aggregateByCategory(actions), [actions]);
  const localPersonnelScope = useMemo(
    () => personnelActions.filter((action) => !isCentralPayrollAction(action)),
    [personnelActions],
  );
  const localBudgetTotals = useMemo(
    () => totalsOf(localPersonnelScope),
    [localPersonnelScope],
  );
  const localPersonnelTotals = useMemo(
    () => personnelTotalsOf(localPersonnelScope),
    [localPersonnelScope],
  );
  const centralPersonnelTotals = useMemo(
    () => personnelTotalsOf(centralPayrollActions),
    [centralPayrollActions],
  );
  const personnelTotals = {
    updatedBudget: localPersonnelTotals.updatedBudget + centralPersonnelTotals.updatedBudget,
    committed: localPersonnelTotals.committed + centralPersonnelTotals.committed,
    liquidated: localPersonnelTotals.liquidated + centralPersonnelTotals.liquidated,
    paid: localPersonnelTotals.paid + centralPersonnelTotals.paid,
  };
  const personnelBudgetBase =
    localBudgetTotals.updatedBudget + centralPersonnelTotals.updatedBudget;
  const hasPersonnelData = Object.values(personnelTotals).some((value) => value !== 0);
  const sourceRows = useMemo(() => aggregateBySource(actions), [actions]);
  const actionRows = useMemo(() => aggregateByAction(actions), [actions]);
  const unitRows = useMemo(() => aggregateByUnit(actions), [actions]);
  const lowerExecutionActions = useMemo(
    () =>
      aggregateByAction(actions.filter((action) => !actionIsAmendment(action)))
        .filter((row) => row.updatedBudget > 0)
        .sort((a, b) => a.executionRate - b.executionRate || b.updatedBudget - a.updatedBudget)
        .slice(0, 8),
    [actions],
  );
  const showUnitComposition = unitFilter === allValue;
  const selectedUnitLabel =
    unitFilter === allValue
      ? 'Todas as unidades'
      : unitOptions.find((option) => option.value === unitFilter)?.label ?? 'Unidade selecionada';
  const payrollCompetence = payrollHeadcount
    ? `${MONTH_NAMES[payrollHeadcount.month - 1] ?? payrollHeadcount.month} de ${payrollHeadcount.year}`
    : null;
  const payrollScopeLabel = payrollHeadcount?.isStatewidePayroll
    ? 'Folha estadual consolidada'
    : unitFilter === allValue
      ? 'Secretaria e entidades vinculadas'
      : 'Unidade selecionada';

  const kpis = [
    { label: 'Dotação inicial', value: totals.initialBudget },
    { label: 'Dotação atualizada', value: totals.updatedBudget },
    { label: 'Empenhado', value: totals.committed },
    { label: 'Liquidado', value: totals.liquidated },
    { label: 'Pago', value: totals.paid },
    { label: 'Disponível', value: totals.available },
  ];
  // Comprometido = empenhado sobre a dotação atualizada. O empenho é justamente o ato
  // que compromete a dotação; o liquidado mede execução já realizada, não compromisso.
  const commitmentRate = executionRate(
    commitmentTotals.committed,
    commitmentTotals.updatedBudget,
  );

  // Gerado a partir das fontes efetivamente usadas: escrito à mão, o texto passaria a
  // mentir a cada órgão novo incluído em EARMARKED_SOURCES_BY_ORGANIZATION.
  const commitmentHelpText = useMemo(() => {
    const describe = (source: string) => {
      const label = getFonteLabel(source);
      return label ? `${source} (${label})` : source;
    };
    const base = 'Valor empenhado dividido pela dotação atualizada, considerando a Fonte 100';
    if (earmarkedSources.length === 0) {
      return `${base} — ${describe(UNRESTRICTED_TREASURY_SOURCE)}. Nenhuma fonte vinculada entra no cálculo deste órgão.`;
    }
    return `${base} — ${describe(UNRESTRICTED_TREASURY_SOURCE)} — somada às fontes vinculadas deste órgão: ${earmarkedSources
      .map(describe)
      .join('; ')}.`;
  }, [earmarkedSources]);
  const cycle = [
    { label: 'Atualizado', value: totals.updatedBudget, base: totals.updatedBudget },
    { label: 'Empenhado', value: totals.committed, base: totals.updatedBudget },
    { label: 'Liquidado', value: totals.liquidated, base: totals.updatedBudget },
    { label: 'Pago', value: totals.paid, base: totals.updatedBudget },
  ];
  const rates = [
    {
      label: 'Empenho',
      value: safeRate(totals.committed, totals.updatedBudget),
      detail: 'do orçamento atualizado',
    },
    {
      label: 'Liquidação',
      value: executionRate(totals.liquidated, totals.updatedBudget),
      detail: 'do orçamento atualizado',
    },
    {
      label: 'Pagamento',
      value: safeRate(totals.paid, totals.liquidated),
      detail: 'do valor liquidado',
    },
  ];
  const personnelMetrics = [
    { label: 'No próprio órgão', value: localPersonnelTotals.updatedBudget },
    { label: 'Folha centralizada SEAD', value: centralPersonnelTotals.updatedBudget },
    { label: 'Total atualizado', value: personnelTotals.updatedBudget },
    { label: 'Empenhado', value: personnelTotals.committed },
    { label: 'Liquidado', value: personnelTotals.liquidated },
    { label: 'Pago', value: personnelTotals.paid },
  ];
  const personnelRates = [
    {
      label: 'Participação no orçamento',
      value: safeRate(personnelTotals.updatedBudget, personnelBudgetBase),
      detail: 'pessoal sobre o orçamento com a folha centralizada',
    },
  ];

  async function present() {
    const target = presentationRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await target.requestFullscreen();
  }

  return (
    <div
      ref={presentationRef}
      className="fiscal-presentation flex h-full min-h-0 flex-col overflow-hidden border bg-white"
    >
      <div className="fiscal-presentation-header shrink-0 border-b bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight text-green-900">
              Visão fiscal da execução
            </h2>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {organization
                ? `${organization.code} — ${organization.name}`
                : 'Selecione uma secretaria para iniciar'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDaysIcon className="size-3.5" />
                {periodLabel(vigenteImport)}
              </span>
              {organization ? (
                <>
                  <span>{selectedUnitLabel}</span>
                  <span>{actions.length.toLocaleString('pt-BR')} ação(ões) no recorte</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="fiscal-presentation-actions flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!organization}
              onClick={() => void present()}
            >
              <Maximize2Icon data-icon="inline-start" />
              Apresentar
            </Button>
            <Button size="sm" disabled={!organization} onClick={() => window.print()}>
              <PrinterIcon data-icon="inline-start" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        <div className="fiscal-selection-controls mt-3 grid gap-3 border-t pt-3 md:grid-cols-[minmax(280px,1.4fr)_minmax(240px,1fr)]">
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Secretaria
            </span>
            <SearchableCombobox
              value={organizationCode}
              onChange={onOrganizationChange}
              items={organizationOptions}
              placeholder="Selecione uma secretaria"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unidade
            </span>
            <SearchableCombobox
              value={unitFilter}
              onChange={onUnitChange}
              items={unitOptions}
              placeholder="Todas as unidades"
              disabled={!organization}
            />
          </label>
        </div>
      </div>

      {!organization ? (
        <Empty className="m-3 min-h-0 flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Selecione uma secretaria</EmptyTitle>
            <EmptyDescription>
              Use o seletor acima para gerar a visão fiscal e, se necessário, detalhar uma unidade.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : actions.length === 0 ? (
        <Empty className="m-3 min-h-0 flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletCardsIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma informação fiscal para a unidade</EmptyTitle>
            <EmptyDescription>
              Selecione outra unidade ou consolide todas as unidades da secretaria.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="fiscal-content min-h-0 flex-1 overflow-auto p-3">
          <div className="grid gap-3">
            <dl className="fiscal-kpis grid grid-cols-2 divide-x divide-y border bg-white md:grid-cols-4 2xl:grid-cols-7 2xl:divide-y-0">
              {kpis.map((kpi) => (
                <FiscalKpi
                  key={kpi.label}
                  label={kpi.label}
                  value={formatMoney(kpi.value)}
                />
              ))}
              <FiscalKpi
                label="Orçamento Comprometido (%)"
                value={formatPercent(commitmentRate)}
                helpText={commitmentHelpText}
              />
            </dl>

            <FiscalSection title="Execução da despesa" className="fiscal-print-section">
              <div className="fiscal-cycle-grid grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[1.4fr_1fr] 2xl:divide-x">
                <div className="min-w-0 2xl:pr-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Estágios orçamentários
                  </h4>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Percentual de cada estágio sobre a dotação atualizada, considerada como 100%.
                  </p>
                <div className="grid gap-2">
                  {cycle.map((item, index) => {
                    const percent = safeRate(item.value, item.base);
                    return (
                      <div
                        key={item.label}
                        className="fiscal-cycle-row grid grid-cols-[86px_1fr_62px_104px] items-center gap-2"
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <div
                          className="h-5 overflow-hidden bg-muted"
                          role="img"
                          aria-label={`${item.label}: ${formatPercent(percent)} da dotação atualizada`}
                        >
                          <div
                            className="h-full min-w-1"
                            style={{
                              width: `${Math.min(100, Math.max(0, percent))}%`,
                              backgroundColor: FISCAL_COLORS[index],
                            }}
                          />
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums">
                          {formatPercent(percent)}
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums">
                          {compactMoney(item.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                </div>

                <div className="min-w-0 2xl:pl-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Índices de execução
                  </h4>
                  <div className="grid gap-3">
                  {rates.map((item, index) => (
                    <div key={item.label} className="fiscal-rate-row grid gap-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <span className="text-base font-bold tabular-nums">
                          {formatPercent(item.value)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, item.value))}%`,
                            backgroundColor: FISCAL_COLORS[index],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </FiscalSection>

            <FiscalSection title="Despesas com pessoal" className="fiscal-print-section fiscal-personnel-section">
              <div className="fiscal-personnel-heading mb-4 grid min-w-0 gap-4 border-b pb-3 xl:grid-cols-[minmax(280px,0.8fr)_minmax(460px,1.2fr)_auto] xl:items-start">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Pessoal consolidado da secretaria
                  </h4>
                  <p className="mt-1 text-sm font-semibold">{personnelScopeLabel}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted-foreground">
                    {personnelScopeNote}
                  </p>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                    Grupo de Natureza 1 somado aos auxílios, benefícios e verbas
                    indenizatórias registrados nas ações de folha.
                  </p>
                </div>

                {payrollHeadcount?.contracts.length ? (
                  <div className="min-w-0 xl:border-x xl:px-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Vínculos ativos por contrato
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {payrollHeadcount.excludedInactiveHeadcount > 0
                          ? `${payrollHeadcount.excludedInactiveHeadcount.toLocaleString('pt-BR')} inativo(s) fora do total`
                          : 'Sem vínculos inativos'}
                      </span>
                    </div>
                    <dl
                      className={cn(
                        'mt-2 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2',
                        payrollHeadcount.contracts.length > 4
                          ? '2xl:grid-cols-3'
                          : '2xl:grid-cols-2',
                      )}
                    >
                      {payrollHeadcount.contracts.map((contract) => {
                        const share = payrollHeadcount.headcount
                          ? (contract.headcount / payrollHeadcount.headcount) * 100
                          : 0;
                        return (
                          <div
                            key={contract.label}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-l-2 border-green-900 pl-2"
                          >
                            <dt
                              className="truncate text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground"
                              title={contract.label}
                            >
                              {contract.label}
                            </dt>
                            <dd className="shrink-0 text-base tabular-nums">
                              <strong className="text-green-900">
                                {contract.headcount.toLocaleString('pt-BR')}
                              </strong>
                              <span className="ml-1 text-xs text-muted-foreground">
                                {formatPercent(share)}
                              </span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ) : (
                  <div className="hidden xl:block" />
                )}

                <div
                  className="min-w-56 border-l-4 border-green-900 bg-muted/40 px-3 py-2"
                  title={
                    payrollHeadcount?.matchedOrganizations.length
                      ? `Correspondências na folha: ${payrollHeadcount.matchedOrganizations.join(', ')}`
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1.5 text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    <UsersIcon className="size-3.5" aria-hidden="true" />
                    Vínculos ativos na folha
                  </div>
                  <p className="mt-1 text-[1.35rem] font-bold leading-none tabular-nums text-green-900">
                    {payrollHeadcount?.headcount === null || !payrollHeadcount
                      ? 'Não identificado'
                      : payrollHeadcount.headcount.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-[0.8rem] text-muted-foreground">
                    {payrollCompetence
                      ? `${payrollScopeLabel} · competência ${payrollCompetence}`
                      : 'Folha de pagamento indisponível'}
                  </p>
                </div>
              </div>

              {hasPersonnelData ? (
                <div className="fiscal-personnel-grid grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr] lg:divide-x">
                  <div className="min-w-0 lg:pr-4">
                    <dl className="fiscal-personnel-metrics grid grid-cols-2 border sm:grid-cols-3">
                      {personnelMetrics.map((item) => (
                        <div
                          key={item.label}
                          className="min-w-0 bg-white px-3 py-2.5 text-foreground opacity-100"
                        >
                          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {item.label}
                          </dt>
                          <dd
                            className="mt-1 truncate text-sm font-bold tabular-nums"
                            title={formatMoney(item.value)}
                          >
                            {formatMoney(item.value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      As ações centralizadas da SEAD são vinculadas por código à secretaria ou
                      unidade correspondente, sem rateio.
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col lg:pl-4">
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Indicador orçamentário de pessoal
                    </h4>
                    <div className="flex min-h-0 flex-1 items-center">
                    <div className="grid w-full gap-4">
                      {personnelRates.map((item, index) => (
                        <div key={item.label} className="fiscal-personnel-rate grid gap-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold">{item.label}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {item.detail}
                              </p>
                            </div>
                            <span className="shrink-0 text-2xl font-bold tabular-nums">
                              {formatPercent(item.value)}
                            </span>
                          </div>
                          <div className="h-2.5 bg-muted">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, item.value))}%`,
                                backgroundColor: FISCAL_COLORS[(index + 1) % FISCAL_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-24 items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-semibold">
                      Nenhuma despesa de pessoal identificada
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Não há Grupo de Natureza 1 no órgão nem ação nominal correspondente na folha
                      centralizada 714/002.
                    </p>
                  </div>
                </div>
              )}
            </FiscalSection>

            <FiscalSection title="Composição do orçamento" className="fiscal-print-section">
              <div
                data-unit-composition={showUnitComposition ? 'visible' : 'hidden'}
                className={cn(
                  'fiscal-composition-grid grid min-w-0 grid-cols-1 gap-5 lg:divide-x',
                  showUnitComposition
                    ? 'lg:grid-cols-[0.8fr_0.8fr_1.4fr]'
                    : 'lg:grid-cols-[0.8fr_1.7fr]',
                )}
              >
                {showUnitComposition ? (
                  <div className="min-w-0 lg:pr-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Por unidade
                  </h4>
                    <MiniBarList
                      rows={unitRows}
                      emptyLabel="Nenhuma unidade com orçamento atualizado."
                    />
                  </div>
                ) : null}
                <div className={cn('min-w-0', showUnitComposition ? 'lg:px-4' : 'lg:pr-4')}>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Por categoria econômica
                  </h4>
                  <MiniBarList
                    rows={categoryRows}
                    emptyLabel="Nenhuma categoria econômica no recorte."
                  />
                </div>
                <div className="min-w-0 lg:pl-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Por fonte de recurso
                  </h4>
                  <MiniBarList
                    rows={sourceRows}
                    emptyLabel="Nenhuma fonte de recurso no recorte."
                  />
                </div>
              </div>
            </FiscalSection>

            <FiscalSection title="Ações orçamentárias" className="fiscal-print-section">
              <div className="fiscal-actions-grid grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 xl:divide-x">
                <div className="min-w-0 xl:pr-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Maiores orçamentos atualizados
                  </h4>
                <MiniBarList
                  rows={actionRows}
                  emptyLabel="Nenhuma ação com orçamento atualizado."
                />
                </div>
                <div className="min-w-0 xl:pl-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Menores índices de execução
                  </h4>
                {lowerExecutionActions.length ? (
                  <div className="fiscal-low-execution-list divide-y">
                    {lowerExecutionActions.map((row) => (
                      <div
                        key={row.key}
                        className="fiscal-low-execution-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium" title={row.label}>
                          {row.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {compactMoney(row.updatedBudget)}
                        </span>
                        <span className="min-w-14 border-l-2 border-green-900 pl-2 text-right font-bold tabular-nums">
                          {formatPercent(row.executionRate)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
                    Nenhuma ação com orçamento positivo.
                  </div>
                )}
                </div>
              </div>
            </FiscalSection>
          </div>
        </div>
      )}
    </div>
  );
}
