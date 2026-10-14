'use client';

import { memo, useMemo, useRef } from 'react';
import { Building2Icon, InfoIcon, Maximize2Icon, PrinterIcon, WalletCardsIcon } from 'lucide-react';
import {
  DonutChart,
  KpiStrip,
  LollipopList,
  MicroLabel,
  Ring,
  ShareLegend,
  TreemapChart,
  VizBlock,
  VizEmpty,
  WaffleChart,
  WatchList,
  paintItems,
  readableLabel,
} from '@/components/domain/execution-visuals';
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoney } from '@/lib/api';
import {
  CHART_CATEGORICAL,
  STAGE_COLORS,
  categoricalColor,
} from '@/lib/chart-palette';
import { shareOf, topWithOther } from '@/lib/chart-geometry';
import {
  aggregateByAction,
  aggregateByCategory,
  aggregateByElement,
  aggregateBySource,
  executionRate,
  isCentralPayrollAction,
  payrollBudgetTotalsOf,
  totalsOf,
  type ExecutionTotals,
} from '@/lib/execution-monitor';
import { getFonteLabel } from '@/lib/fontes-recursos';
import { actionIsAmendment } from '@/lib/functional-classification';
import { compactMoney, formatPercent } from '@/lib/number-format';
import { organizationAcronym } from '@/lib/organization-acronym';
import type { PayrollHeadcountScope } from '@/lib/payroll-scope';
import { readableName } from '@/lib/readable-name';
import type { BudgetAction, BudgetImport, Organization } from '@/types/domain';

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

/** Nome do órgão sem a sigla do fim: "Secretaria de Estado de Saúde (SESACRE)" → "…Saúde". */
function organizationDisplayName(organization: Organization) {
  return readableName(organization.name).replace(/ \([^)]+\)$/, '');
}

/** Um fato do bloco de folha: rótulo, valor por extenso e linha de leitura. */
function PayrollFact({
  label,
  value,
  detail,
  rate,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  rate?: number;
  color?: string;
}) {
  return (
    <div>
      <MicroLabel className="mb-0.5">{label}</MicroLabel>
      <div className="text-[17px] font-semibold tabular-nums">{formatMoney(value)}</div>
      <div className="mt-0.5 flex items-center gap-[7px] text-[13px] text-[#4a504b] tabular-nums">
        {rate != null ? <Ring value={rate} size={18} color={color} /> : null}
        <span>{detail}</span>
      </div>
    </div>
  );
}

export const FiscalSecretariatView = memo(function FiscalSecretariatView({
  actions,
  personnelActions,
  centralPayrollActions,
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
      // O exercício vem das próprias ações: o catálogo de fontes é por ano.
      const label = getFonteLabel(source, actions[0]?.year);
      return label ? `${source} (${label})` : source;
    };
    const base = 'Valor empenhado dividido pela dotação atualizada, considerando a Fonte 100';
    if (earmarkedSources.length === 0) {
      return `${base} — ${describe(UNRESTRICTED_TREASURY_SOURCE)}. Nenhuma fonte vinculada entra no cálculo deste órgão.`;
    }
    return `${base} — ${describe(UNRESTRICTED_TREASURY_SOURCE)} — somada às fontes vinculadas deste órgão: ${earmarkedSources
      .map(describe)
      .join('; ')}.`;
  }, [earmarkedSources, actions]);

  // ── Folha de pagamento (contrato, seção 6.6) ──
  const localPersonnelScope = useMemo(
    () => personnelActions.filter((action) => !isCentralPayrollAction(action)),
    [personnelActions],
  );
  const localBudgetTotals = useMemo(() => totalsOf(localPersonnelScope), [localPersonnelScope]);
  const localPayroll = useMemo(() => payrollBudgetTotalsOf(localPersonnelScope), [localPersonnelScope]);
  const centralPayroll = useMemo(
    () => payrollBudgetTotalsOf(centralPayrollActions),
    [centralPayrollActions],
  );
  const payroll = {
    updatedBudget: localPayroll.updatedBudget + centralPayroll.updatedBudget,
    committed: localPayroll.committed + centralPayroll.committed,
    liquidated: localPayroll.liquidated + centralPayroll.liquidated,
    excluded: localPayroll.excludedUpdatedBudget + centralPayroll.excludedUpdatedBudget,
  };
  const payrollShare = shareOf(
    payroll.updatedBudget,
    localBudgetTotals.updatedBudget + centralPayroll.updatedBudget,
  );
  const payrollParts = paintItems(
    [
      { key: 'local', label: 'Próprio órgão', value: localPayroll.updatedBudget },
      { key: 'central', label: 'Centralizada na SEAD', value: centralPayroll.updatedBudget },
    ],
    [STAGE_COLORS.budget, CHART_CATEGORICAL[3]],
  );
  const payrollCompetence = payrollHeadcount
    ? `${MONTH_NAMES[payrollHeadcount.month - 1] ?? payrollHeadcount.month} de ${payrollHeadcount.year}`
    : null;

  // ── Composição ──
  const showUnitComposition = unitFilter === allValue;
  const unitRows = useMemo(() => aggregateByUnit(actions), [actions]);
  const elementRows = useMemo(() => aggregateByElement(actions), [actions]);
  const compositionItems = useMemo(() => {
    const rows = showUnitComposition
      ? unitRows.map((row) => ({ key: row.key, label: row.label, value: row.updatedBudget }))
      : elementRows.map((row) => ({ key: row.key, label: row.label, value: row.updatedBudget }));
    return rows
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((row, index) => ({
        key: row.key,
        label: readableLabel(row.label),
        short: readableLabel(row.label),
        value: row.value,
        color: categoricalColor(index),
        ink: '#ffffff',
      }));
  }, [elementRows, showUnitComposition, unitRows]);
  const sourceRows = useMemo(() => aggregateBySource(actions), [actions]);
  const sourceItems = useMemo(
    () =>
      paintItems(
        topWithOther(
          sourceRows.map((row) => ({ key: row.key, label: readableLabel(row.label), value: row.updatedBudget })),
          4,
          'Demais fontes',
          totals.updatedBudget,
        ),
        CHART_CATEGORICAL,
      ),
    [sourceRows, totals.updatedBudget],
  );
  const categoryRows = useMemo(() => aggregateByCategory(actions), [actions]);
  const categoryItems = useMemo(
    () =>
      paintItems(
        [...categoryRows]
          .filter((row) => row.updatedBudget > 0)
          .sort((a, b) => b.updatedBudget - a.updatedBudget)
          .map((row) => ({ key: row.key, label: readableLabel(row.label), value: row.updatedBudget })),
        CHART_CATEGORICAL,
      ),
    [categoryRows],
  );
  const currentCategory = categoryRows.find((row) => row.key === '3');

  // ── Ações ──
  const actionRows = useMemo(() => aggregateByAction(actions), [actions]);
  const topActions = useMemo(
    () =>
      [...actionRows]
        .filter((row) => row.updatedBudget > 0)
        .sort((a, b) => b.updatedBudget - a.updatedBudget)
        .slice(0, 5)
        .map((row) => ({
          key: row.key,
          label: readableLabel(row.label),
          value: row.updatedBudget,
          rate: row.executionRate,
        })),
    [actionRows],
  );
  const lowExecution = useMemo(
    () =>
      aggregateByAction(actions.filter((action) => !actionIsAmendment(action)))
        .filter((row) => row.updatedBudget > 0)
        .sort((a, b) => a.executionRate - b.executionRate || b.updatedBudget - a.updatedBudget),
    [actions],
  );
  // No meio do exercício quase toda ação já liquidou algo; sem nenhuma parada, a
  // lista vira "menor execução" em vez de sumir (contrato, seção 6.5).
  const notLiquidated = lowExecution.filter((row) => row.liquidated <= 0);
  const watchRows = (notLiquidated.length ? notLiquidated : lowExecution).slice(0, 5);
  const watchByRate = notLiquidated.length === 0;

  const acronym = organization ? organizationAcronym(organization.code, organization.name) : '';
  const largestShare = (items: { value: number }[]) => shareOf(items[0]?.value ?? 0, totals.updatedBudget);
  const topTwoUnits = shareOf(
    (compositionItems[0]?.value ?? 0) + (compositionItems[1]?.value ?? 0),
    totals.updatedBudget,
  );

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
    <div ref={presentationRef} className="fiscal-presentation min-w-0 bg-white">
      <section className="fiscal-presentation-header flex flex-wrap items-end gap-6 px-6 pb-6 pt-8 xl:px-10">
        <div className="min-w-0">
          <MicroLabel>
            {organization
              ? `${acronym} · órgão ${organization.code} · ${periodLabel(vigenteImport)} · ${actions.length.toLocaleString('pt-BR')} ações`
              : periodLabel(vigenteImport)}
          </MicroLabel>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.015em]">
            {organization ? organizationDisplayName(organization) : 'Visão por órgão'}
          </h1>
          {organization && actions.length ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-[#4a504b] [&_b]:font-semibold [&_b]:text-[#141714] [&_b]:tabular-nums">
              <span>
                Orçamento comprometido <b>{formatPercent(commitmentRate)}</b>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="fiscal-kpi-help inline-flex shrink-0 text-marca-escura focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-escura"
                    aria-label="Como é calculado: Orçamento comprometido"
                  >
                    <InfoIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-sm">
                  {commitmentHelpText}
                </TooltipContent>
              </Tooltip>
              <span>
                · disponível para empenho <b>{formatMoney(totals.available)}</b>
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[13.5px] text-[#4a504b]">
              Escolha a secretaria para ver a execução, a folha e a composição do orçamento.
            </p>
          )}
        </div>
        <div className="fiscal-selection-controls ml-auto flex flex-wrap items-center gap-2.5">
          <SearchableCombobox
            className="relative w-72 min-w-0"
            value={organizationCode}
            onChange={onOrganizationChange}
            items={organizationOptions}
            placeholder="Selecione uma secretaria"
          />
          <SearchableCombobox
            className="relative w-56 min-w-0"
            value={unitFilter}
            onChange={onUnitChange}
            items={unitOptions}
            placeholder="Unidade: todas"
            disabled={!organization}
          />
          <div className="fiscal-presentation-actions flex gap-2.5">
            <Button variant="outline" disabled={!organization} onClick={() => void present()}>
              <Maximize2Icon data-icon="inline-start" />
              Apresentar
            </Button>
            <Button variant="outline" disabled={!organization} onClick={() => window.print()}>
              <PrinterIcon data-icon="inline-start" />
              Imprimir
            </Button>
          </div>
        </div>
      </section>

      {!organization ? (
        <div className="px-6 pb-10 xl:px-10">
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Selecione uma secretaria</EmptyTitle>
            <EmptyDescription>
              Use o seletor acima para gerar a visão do órgão e, se necessário, detalhar uma unidade.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        </div>
      ) : actions.length === 0 ? (
        <div className="px-6 pb-10 xl:px-10">
        <Empty className="min-h-72 border">
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
        </div>
      ) : (
        <div className="fiscal-content">
          <KpiStrip totals={totals} className="fiscal-kpis border-t" />
          <div className="fiscal-grid grid grid-cols-1 gap-x-10 gap-y-8 px-6 pb-10 pt-8 xl:px-10 min-[1180px]:grid-cols-2">
            <VizBlock
              title="Folha de pagamento"
              summary={
                payroll.updatedBudget > 0 ? (
                  <>
                    Gastos de folha do QDD: <b>{compactMoney(payroll.updatedBudget)}</b>,{' '}
                    {formatPercent(payrollShare)} do orçamento do órgão somado à parte dele na
                    folha centralizada da SEAD. Sem terceirização.
                  </>
                ) : undefined
              }
            >
              {payroll.updatedBudget > 0 ? (
                <div className="grid items-center gap-x-7 gap-y-6 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <div>
                    <DonutChart
                      items={payrollParts}
                      total={payroll.updatedBudget}
                      center={compactMoney(payroll.updatedBudget)}
                      caption="de folha"
                      size={190}
                      label="Folha do próprio órgão e folha centralizada"
                    />
                    <ShareLegend
                      items={payrollParts}
                      total={payroll.updatedBudget}
                      showValue={false}
                      className="mt-3.5 text-[12.5px]"
                    />
                  </div>
                  <div className="grid gap-3.5">
                    <PayrollFact
                      label="Dotação de folha"
                      value={payroll.updatedBudget}
                      detail={`${localPayroll.actionCount} ${localPayroll.actionCount === 1 ? 'ação' : 'ações'} do órgão + ${centralPayroll.actionCount} na SEAD`}
                    />
                    <PayrollFact
                      label="Empenhado"
                      value={payroll.committed}
                      rate={shareOf(payroll.committed, payroll.updatedBudget)}
                      color={STAGE_COLORS.committed}
                      detail={`${formatPercent(shareOf(payroll.committed, payroll.updatedBudget))} da dotação de folha`}
                    />
                    <PayrollFact
                      label="Liquidado"
                      value={payroll.liquidated}
                      rate={shareOf(payroll.liquidated, payroll.updatedBudget)}
                      color={STAGE_COLORS.liquidated}
                      detail={`${formatPercent(shareOf(payroll.liquidated, payroll.updatedBudget))} da dotação de folha`}
                    />
                    <p className="text-[12.5px] leading-snug text-[#80857f]">
                      Fora do cálculo: terceirização (elemento 34) e serviços de terceiros pessoa
                      física (36)
                      {payroll.excluded > 0 ? `, somando ${compactMoney(payroll.excluded)}` : ''}.
                      {unitFilter !== allValue && personnelScopeNote ? ` ${personnelScopeNote}` : ''}
                    </p>
                    <p
                      className="border-t border-[#e1e3dd] pt-3 text-[13px] text-[#4a504b] [&_b]:font-semibold [&_b]:text-[#141714] [&_b]:tabular-nums"
                      title={
                        payrollHeadcount?.matchedOrganizations.length
                          ? `Correspondências na folha: ${payrollHeadcount.matchedOrganizations.join(', ')}`
                          : undefined
                      }
                    >
                      {payrollCompetence ? (
                        <>
                          Vínculos ativos na folha:{' '}
                          <b>
                            {payrollHeadcount?.headcount == null
                              ? 'não identificado'
                              : payrollHeadcount.headcount.toLocaleString('pt-BR')}
                          </b>
                          {payrollHeadcount?.isStatewidePayroll ? ' (folha estadual consolidada)' : ''} ·
                          competência {payrollCompetence}
                          {payrollHeadcount && payrollHeadcount.excludedInactiveHeadcount > 0
                            ? ` · ${payrollHeadcount.excludedInactiveHeadcount.toLocaleString('pt-BR')} inativo(s) fora do total`
                            : ''}
                        </>
                      ) : (
                        'Folha de pagamento indisponível: a coleta do Portal da Transparência ainda não trouxe um mês.'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <VizEmpty>
                  Nenhuma ação de folha de pagamento no órgão nem na folha centralizada 714/002.
                </VizEmpty>
              )}
            </VizBlock>

            <VizBlock
              title={showUnitComposition ? 'Por unidade' : 'Por elemento de despesa'}
              summary={
                compositionItems.length > 1 ? (
                  showUnitComposition ? (
                    <>
                      Duas unidades concentram <b>{formatPercent(topTwoUnits)}</b> da dotação.
                    </>
                  ) : (
                    <>
                      {compositionItems[0]!.label} responde por{' '}
                      <b>{formatPercent(largestShare(compositionItems))}</b> da dotação da unidade.
                    </>
                  )
                ) : compositionItems.length === 1 ? (
                  <>Toda a dotação está em {compositionItems[0]!.label}.</>
                ) : undefined
              }
            >
              {compositionItems.length ? (
                <>
                  <TreemapChart
                    items={compositionItems.slice(0, 12)}
                    height={230}
                    label={showUnitComposition ? 'Dotação por unidade' : 'Dotação por elemento de despesa'}
                  />
                  <ShareLegend
                    items={compositionItems.slice(0, 4)}
                    total={totals.updatedBudget}
                    showValue={false}
                    className="mt-3.5 gap-x-6 sm:grid-cols-2"
                  />
                </>
              ) : (
                <VizEmpty>Nenhuma dotação atualizada positiva no recorte.</VizEmpty>
              )}
            </VizBlock>

            <VizBlock
              title="Por fonte de recurso"
              summary={
                sourceItems.length ? (
                  <>
                    A maior fonte responde por <b>{formatPercent(largestShare(sourceItems))}</b>. Cada
                    quadrado é 1% da dotação.
                  </>
                ) : undefined
              }
            >
              {sourceItems.length ? (
                <div className="grid items-center gap-x-7 gap-y-6 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <WaffleChart items={sourceItems} total={totals.updatedBudget} label="Dotação por fonte de recurso" />
                  <ShareLegend items={sourceItems} total={totals.updatedBudget} />
                </div>
              ) : (
                <VizEmpty>Nenhuma fonte de recurso com dotação no recorte.</VizEmpty>
              )}
            </VizBlock>

            <VizBlock
              title="Por categoria econômica"
              summary={
                currentCategory ? (
                  <>
                    <b>{formatPercent(shareOf(currentCategory.updatedBudget, totals.updatedBudget))}</b> é
                    despesa corrente; o restante, de capital.
                  </>
                ) : undefined
              }
            >
              {categoryItems.length ? (
                <div className="grid items-center gap-x-7 gap-y-6 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <DonutChart
                    items={categoryItems}
                    total={totals.updatedBudget}
                    center={formatPercent(shareOf(currentCategory?.updatedBudget ?? 0, totals.updatedBudget))}
                    caption="correntes"
                    size={190}
                    label="Dotação por categoria econômica"
                  />
                  <ShareLegend items={categoryItems} total={totals.updatedBudget} />
                </div>
              ) : (
                <VizEmpty>Nenhuma categoria econômica com dotação no recorte.</VizEmpty>
              )}
            </VizBlock>

            <VizBlock title="Maiores orçamentos" summary="As cinco ações com maior dotação atualizada.">
              {topActions.length ? (
                <LollipopList rows={topActions} />
              ) : (
                <VizEmpty>Nenhuma ação com dotação atualizada positiva.</VizEmpty>
              )}
            </VizBlock>

            <VizBlock
              title={watchByRate ? 'Menor execução' : 'Sem nenhum valor liquidado'}
              summary={
                watchByRate
                  ? `Todas as ações já liquidaram algo; estas são as cinco com menor execução (sem emendas) até ${periodLabel(vigenteImport).replace(/^Acumulado até |^Mês de /, '')}.`
                  : `Maiores dotações, sem emendas, que ainda não liquidaram nada (${periodLabel(vigenteImport).toLowerCase()}).`
              }
            >
              {watchRows.length ? (
                <WatchList
                  rows={watchRows.map((row) => ({
                    key: row.key,
                    label: readableLabel(row.label),
                    title: row.label,
                    value: watchByRate
                      ? `${formatPercent(row.executionRate)} de ${compactMoney(row.updatedBudget)}`
                      : compactMoney(row.updatedBudget),
                  }))}
                />
              ) : (
                <VizEmpty>Nenhuma ação sem emenda com dotação positiva no recorte.</VizEmpty>
              )}
            </VizBlock>
          </div>
        </div>
      )}
    </div>
  );
});
