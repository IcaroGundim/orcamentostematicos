'use client';

import { Fragment, memo, useRef, useState } from 'react';
import { ChevronDownIcon, XIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/api';
import { CHANGE_TEXT_COLORS, CHART_CATEGORICAL } from '@/lib/chart-palette';
import { niceScale, shareOf } from '@/lib/chart-geometry';
import { compactAxis, compactMoney, formatPercent, signedMoney } from '@/lib/number-format';
import {
  REVENUE_GROUP_LABELS,
  REVENUE_GROUPS,
  compareSamePeriod,
  selectedGroupNet,
  type RevenueDto,
  type RevenueGroup,
  type RevenueRow,
} from '@/lib/revenue';
import { summarizeDuodecimo, type DuodecimoBase, type DuodecimoSummary } from '@/lib/duodecimo';
import { cn } from '@/lib/utils';
import {
  MicroLabel,
  Ring,
  VizBlock,
  VizEmpty,
  useChartTooltip,
  useMeasuredWidth,
  type TooltipRow,
} from './execution-visuals';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
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
];

/** Uma cor por grupo, na ordem fixa da paleta categórica. */
const GROUP_COLORS: Record<RevenueGroup, string> = {
  tributaria: CHART_CATEGORICAL[0],
  transferencias: CHART_CATEGORICAL[1],
  demais: CHART_CATEGORICAL[2],
};

const INK = '#141714';
const INK_3 = '#80857f';
const GRID = '#ecede8';

// ── Régua ────────────────────────────────────────────────────────────────────

function RevenueKpi({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="min-w-0">
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-1.5 whitespace-nowrap text-[14px] font-semibold tracking-tight tabular-nums sm:text-[17px]">
        {value < 0 ? signedMoney(value) : formatMoney(value)}
      </div>
      <div className="mt-1.5 truncate text-[13px] text-[#4a504b] tabular-nums" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function RevenueStrip({ data, previous }: { data: RevenueDto; previous?: RevenueDto }) {
  const realized = shareOf(data.netTotal, data.updatedForecast);
  const comparison = compareSamePeriod(data, previous);
  const period =
    comparison && comparison.months.length < 12
      ? `${MONTHS_SHORT[comparison.months[0] - 1]}–${MONTHS_SHORT[comparison.months.at(-1)! - 1]}`
      : null;
  const comparisonDetail =
    comparison?.change != null
      ? `${comparison.change >= 0 ? '+' : '−'}${formatPercent(Math.abs(comparison.change))} sobre ${data.year - 1}${
          period ? ` (${period})` : ''
        }`
      : `líquido, ${data.months.length} ${data.months.length === 1 ? 'mês' : 'meses'}`;
  const closed = data.months.filter((month) => month !== data.partialMonth);
  const lastClosed = closed.at(-1);
  const closedAverage = closed.length
    ? closed.reduce((total, month) => total + data.monthlyNet[month - 1], 0) / closed.length
    : 0;
  return (
    <section
      aria-label="Indicadores da receita"
      className="grid gap-x-8 gap-y-6 border-b border-[#e1e3dd] bg-[#f5f6f2] px-6 py-6 sm:grid-cols-2 xl:grid-cols-5 xl:px-10"
    >
      <div className="flex min-w-0 items-center gap-3 sm:col-span-2 xl:col-span-1">
        <Ring value={realized} size={70} width={9} color={GROUP_COLORS.tributaria} />
        <div className="min-w-0">
          <MicroLabel>Realizado</MicroLabel>
          <div className="mt-1.5 text-[40px] font-bold leading-none tracking-[-0.025em] tabular-nums">
            {formatPercent(realized)}
          </div>
          <div className="mt-1.5 text-[13px] text-[#4a504b]">arrecadado ÷ previsão atualizada</div>
        </div>
      </div>
      <RevenueKpi label={`Arrecadado em ${data.year}`} value={data.netTotal} detail={comparisonDetail} />
      <RevenueKpi label="Previsão atualizada" value={data.updatedForecast} detail={`lei: ${formatMoney(data.forecast)}`} />
      <RevenueKpi
        label={lastClosed ? `Arrecadado em ${MONTHS_SHORT[lastClosed - 1]}` : 'Último mês fechado'}
        value={lastClosed ? data.monthlyNet[lastClosed - 1] : 0}
        detail={closed.length ? `média mensal ${compactMoney(closedAverage)}` : 'nenhum mês fechado ainda'}
      />
      <RevenueKpi
        label="Deduções"
        value={data.deductionsTotal}
        detail={`bruto ${compactMoney(data.grossTotal)}, sobretudo FUNDEB`}
      />
    </section>
  );
}

// ── Filtro de tributos ───────────────────────────────────────────────────────

/** Valor do botão: o que está marcado, curto o bastante para caber nele. */
function filterLabel(rows: RevenueRow[], hidden: ReadonlySet<string>): string {
  const shown = rows.filter((row) => !hidden.has(row.key));
  if (shown.length === rows.length) return 'Todos';
  if (!shown.length) return 'Nenhum';
  if (shown.length === 1) return shown[0].label;
  return `${shown.length} de ${rows.length}`;
}

/**
 * Filtro do gráfico mês a mês: rótulo "Tributos" e o valor sublinhado, no molde do
 * seletor "Ano das receitas" (sem caixa, cantos ou sombra), que abre
 * a lista de categorias presentes no ano, agrupadas, com a caixa do grupo
 * marcando/desmarcando todas (intermediária quando só parte está marcada). Guarda
 * as **desmarcadas**: categoria que aparece ao trocar de ano entra marcada.
 */
function CategoryFilter({
  rows,
  hidden,
  onChange,
}: {
  rows: RevenueRow[];
  hidden: ReadonlySet<string>;
  onChange: (hidden: Set<string>) => void;
}) {
  const toggle = (keys: string[], show: boolean) => {
    const next = new Set(hidden);
    for (const key of keys) {
      if (show) next.delete(key);
      else next.add(key);
    }
    onChange(next);
  };
  const anyHidden = rows.some((row) => hidden.has(row.key));
  const anyShown = rows.some((row) => !hidden.has(row.key));
  return (
    <Popover>
      {/* Caixa reta de borda fina (sem cantos nem sombra): visível como controle sem
          virar o botão arredondado dos filtros do QDD. Com filtro ativo, a borda e
          o valor escurecem e aparece o × para voltar a todos. */}
      <span className="relative inline-flex max-w-full">
        <PopoverTrigger
          className={cn(
            'group/trigger inline-flex h-9 min-w-0 max-w-full items-center gap-2.5 border bg-white pl-3 text-sm outline-none transition-colors',
            'hover:border-[#141714] data-[state=open]:border-[#141714]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca',
            anyHidden ? 'border-[#141714] pr-9' : 'border-[#c3c6bf] pr-2.5',
          )}
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#80857f]">
            Tributos
          </span>
          <span className="truncate font-bold text-[#141714]">
            {filterLabel(rows, hidden)}
          </span>
          {anyHidden ? null : (
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 text-[#80857f] transition-transform duration-200 group-hover/trigger:text-[#141714] group-data-[state=open]/trigger:rotate-180"
            />
          )}
        </PopoverTrigger>
        {anyHidden ? (
          <button
            type="button"
            aria-label="Limpar filtro de tributos"
            title="Mostrar todos"
            onClick={() => onChange(new Set())}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-[#80857f] hover:text-[#141714] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-marca"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </span>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-none border-[#c3c6bf] p-0 shadow-none"
      >
        <fieldset className="text-[13.5px] text-[#4a504b]">
          <legend className="sr-only">Tributos e receitas exibidos no gráfico</legend>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#e1e3dd] px-3 py-2">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[#80857f]">
              Exibir no gráfico
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                disabled={!anyHidden}
                onClick={() => onChange(new Set())}
                className={LINK_BUTTON_CLASS}
              >
                Marcar todos
              </button>
              <span aria-hidden className="h-3.5 w-px bg-[#e1e3dd]" />
              <button
                type="button"
                disabled={!anyShown}
                onClick={() => onChange(new Set(rows.map((row) => row.key)))}
                className={LINK_BUTTON_CLASS}
              >
                Desmarcar todos
              </button>
            </span>
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-color:#c3c6bf_transparent] [scrollbar-width:thin]">
            {REVENUE_GROUPS.map((group) => {
              const members = rows.filter((row) => row.group === group);
              if (!members.length) return null;
              const shown = members.filter((row) => !hidden.has(row.key)).length;
              const state = shown === members.length ? true : shown === 0 ? false : 'indeterminate';
              return (
                <div key={group} className="py-1.5">
                  <label className="flex cursor-pointer items-center gap-2 py-1 font-semibold text-[#141714]">
                    <Checkbox
                      checked={state}
                      onCheckedChange={() => toggle(members.map((row) => row.key), state !== true)}
                      className={CHECKBOX_CLASS}
                    />
                    <i aria-hidden className="inline-block size-2.5" style={{ backgroundColor: GROUP_COLORS[group] }} />
                    {REVENUE_GROUP_LABELS[group]}
                  </label>
                  {members.map((row) => (
                    <label key={row.key} className="flex cursor-pointer items-center gap-2 py-1 pl-6">
                      <Checkbox
                        checked={!hidden.has(row.key)}
                        onCheckedChange={(checked) => toggle([row.key], checked === true)}
                        className={CHECKBOX_CLASS}
                      />
                      {row.label}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

/** Ação em texto do cabeçalho do filtro ("Marcar todos", "Desmarcar todos"). */
const LINK_BUTTON_CLASS =
  'text-[13px] font-semibold text-[#141714] underline underline-offset-2 disabled:cursor-default disabled:text-[#c3c6bf] disabled:no-underline';

/** Caixa quadrada em tinta escura, sem o verde da marca (que fica no cromo). */
const CHECKBOX_CLASS =
  'rounded-none border-[#80857f] data-[state=checked]:border-[#141714] data-[state=checked]:bg-[#141714] data-[state=checked]:text-white data-[state=indeterminate]:border-[#141714] data-[state=indeterminate]:bg-[#141714] data-[state=indeterminate]:text-white';

// ── Colunas mês a mês ────────────────────────────────────────────────────────

const MonthlyColumns = memo(function MonthlyColumns({ data }: { data: RevenueDto }) {
  const { bind, tooltip } = useChartTooltip();
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(boxRef, 720);
  // Fica entre trocas de ano: o componente segue montado e só `data` muda.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const height = 300;
  const pad = { left: 56, right: 8, top: 24, bottom: 30 };

  const selected = new Set(data.rows.filter((row) => !hidden.has(row.key)).map((row) => row.key));
  const allSelected = selected.size === data.rows.length;
  // Líquido de cada grupo por mês, só das categorias marcadas (seção 6.8); um grupo
  // negativo (só deduções) não empilha.
  const groups = selectedGroupNet(data.rows, selected);
  const stacks = data.monthlyNet.map((_, index) =>
    groups.map((group) => ({ group: group.group, value: Math.max(0, group.net[index]) })),
  );
  // Topo do eixo no primeiro passo redondo acima do maior mês (0, 500 mi, 1 bi…).
  const scale = niceScale(Math.max(0, ...stacks.map((stack) => stack.reduce((total, part) => total + part.value, 0))));
  const max = scale.top;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const slot = plotWidth / 12;
  const barWidth = Math.min(48, slot * 0.62);
  const y = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px] text-[#4a504b]">
        <CategoryFilter rows={data.rows} hidden={hidden} onChange={setHidden} />
        {/* Filete entre o controle e a legenda: são coisas diferentes na mesma linha. */}
        {groups.length ? <span aria-hidden className="h-4 w-px bg-[#e1e3dd]" /> : null}
        {groups.map(({ group, label }) => (
          <span key={group} className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2.5" style={{ backgroundColor: GROUP_COLORS[group] }} />
            {label}
          </span>
        ))}
      </div>
      <div ref={boxRef}>
        {selected.size === 0 ? (
          <VizEmpty>Nenhum tributo ou receita marcado. Marque ao menos um para ver o gráfico.</VizEmpty>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={
              allSelected
                ? 'Receita arrecadada por mês, líquida das deduções'
                : `Receita arrecadada por mês, líquida das deduções: ${data.rows
                    .filter((row) => selected.has(row.key))
                    .map((row) => row.label)
                    .join(', ')}`
            }
            className="block h-auto w-full"
          >
            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={GRID} />
                <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={12} fill={INK_3}>
                  {compactAxis(tick)}
                </text>
              </g>
            ))}
            {stacks.map((stack, index) => {
              const month = index + 1;
              const x = pad.left + index * slot + (slot - barWidth) / 2;
              const queried = data.months.includes(month);
              const partial = month === data.partialMonth;
              const shownNet = groups.reduce((total, group) => total + group.net[index], 0);
              // Com tudo marcado, o detalhe mostra os grupos, o bruto e as deduções; com
              // filtro, cada categoria marcada e o total do mês para comparação.
              const rows: TooltipRow[] = allSelected
                ? [
                    ...stack.map((part) => ({
                      label: REVENUE_GROUP_LABELS[part.group],
                      value: formatMoney(part.value),
                      color: GROUP_COLORS[part.group],
                    })),
                    'divider',
                    { label: 'Bruto', value: formatMoney(data.monthlyGross[index]) },
                    { label: 'Deduções', value: formatMoney(data.monthlyDeductions[index]) },
                  ]
                : [
                    ...data.rows
                      .filter((row) => selected.has(row.key))
                      .map((row) => ({
                        label: row.label,
                        value: formatMoney(row.net[index]),
                        color: GROUP_COLORS[row.group],
                      })),
                    'divider',
                    { label: 'Total do mês (todas as receitas)', value: formatMoney(data.monthlyNet[index]) },
                  ];
              let top = pad.top + plotHeight;
              return (
                <g
                  key={month}
                  {...(queried
                    ? bind({
                        title: `${MONTHS_LONG[index]} de ${data.year}${partial ? ' (parcial)' : ''}`,
                        big: {
                          label: allSelected ? 'arrecadado líquido' : 'líquido dos marcados',
                          value: formatMoney(shownNet),
                        },
                        rows,
                        note: partial ? 'Mês em curso: o portal ainda está recebendo a arrecadação.' : undefined,
                      })
                    : {})}
                >
                  <rect x={pad.left + index * slot} y={pad.top} width={slot} height={plotHeight} fill="transparent" />
                  {stack.map((part) => {
                    const h = (part.value / max) * plotHeight;
                    top -= h;
                    return (
                      <rect
                        key={part.group}
                        x={x}
                        y={top}
                        width={barWidth}
                        height={h}
                        fill={GROUP_COLORS[part.group]}
                        opacity={partial ? 0.45 : 1}
                      />
                    );
                  })}
                  <text
                    x={x + barWidth / 2}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize={12}
                    fill={queried ? INK : INK_3}
                  >
                    {MONTHS_SHORT[index]}
                    {partial ? '*' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {tooltip}
    </>
  );
});

// ── Tabela por tributo ───────────────────────────────────────────────────────

const RevenueTable = memo(function RevenueTable({ data }: { data: RevenueDto }) {
  const months = data.months;
  const cell = 'px-2.5 py-2 text-right tabular-nums whitespace-nowrap';
  const valueCell = (value: number, title?: string) => (
    <td className={cell} title={title ?? formatMoney(value)}>
      {value === 0 ? <span className="text-[#c3c6bf]">–</span> : compactMoney(value)}
    </td>
  );
  const rateCell = (net: number, forecast: number) => {
    const rate = shareOf(net, forecast);
    return (
      <td className={cn(cell, 'pr-0')}>
        {forecast > 0 ? (
          <span className="inline-flex items-center justify-end gap-1.5">
            <Ring value={rate} size={16} width={3} color={GROUP_COLORS.tributaria} />
            {formatPercent(rate)}
          </span>
        ) : (
          <span className="text-[#c3c6bf]">–</span>
        )}
      </td>
    );
  };
  const breakdown = (row: RevenueRow, index: number) =>
    row.deductions[index]
      ? `${formatMoney(row.net[index])} = bruto ${formatMoney(row.gross[index])} ${signedMoney(row.deductions[index])} de deduções`
      : formatMoney(row.net[index]);

  return (
    <div className="max-w-full overflow-x-auto [scrollbar-color:#c3c6bf_transparent] [scrollbar-width:thin]">
      <table className="w-full min-w-[960px] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b-2 border-[#141714] text-left">
            <th className="sticky left-0 bg-white py-2 pr-3 font-semibold">Tributo</th>
            {months.map((month) => (
              <th key={month} className="px-2.5 py-2 text-right font-semibold capitalize">
                {MONTHS_SHORT[month - 1]}
                {month === data.partialMonth ? '*' : ''}
              </th>
            ))}
            <th className="px-2.5 py-2 text-right font-semibold">No ano</th>
            <th className="px-2.5 py-2 text-right font-semibold">Previsão atualizada</th>
            <th className="py-2 pl-2.5 text-right font-semibold">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map(({ group, label, net, netTotal, updatedForecast }) => {
            const rows = data.rows.filter((row) => row.group === group);
            return (
              <Fragment key={group}>
                <tr className="border-b border-[#e1e3dd] bg-[#f5f6f2] font-semibold">
                  <td className="sticky left-0 bg-[#f5f6f2] py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <i aria-hidden className="inline-block size-2.5" style={{ backgroundColor: GROUP_COLORS[group] }} />
                      {label}
                    </span>
                  </td>
                  {months.map((month) => (
                    <Fragment key={month}>{valueCell(net[month - 1])}</Fragment>
                  ))}
                  {valueCell(netTotal)}
                  {valueCell(updatedForecast)}
                  {rateCell(netTotal, updatedForecast)}
                </tr>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-[#ecede8]">
                    <td className="sticky left-0 bg-white py-2 pl-[18px] pr-3">{row.label}</td>
                    {months.map((month) => (
                      <Fragment key={month}>{valueCell(row.net[month - 1], breakdown(row, month - 1))}</Fragment>
                    ))}
                    {valueCell(row.netTotal)}
                    {valueCell(row.updatedForecast)}
                    {rateCell(row.netTotal, row.updatedForecast)}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#141714] font-bold">
            <td className="sticky left-0 bg-white py-2 pr-3">Total</td>
            {months.map((month) => (
              <Fragment key={month}>{valueCell(data.monthlyNet[month - 1])}</Fragment>
            ))}
            {valueCell(data.netTotal)}
            {valueCell(data.updatedForecast)}
            {rateCell(data.netTotal, data.updatedForecast)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

// ── Duodécimo dos Poderes ────────────────────────────────────────────────────

/** Dotação de fonte 100 dos Poderes no QDD carregado (`treasuryAppropriationByOrganization`). */
export interface BranchAppropriations {
  year: number;
  byOrganization: Record<string, { initialBudget: number; updatedBudget: number }>;
}

const BASE_LINES: Array<{ key: keyof DuodecimoBase; label: string; detail: string; sign: '' | '−' | '=' }> = [
  {
    key: 'revenue',
    label: 'Receita da base',
    detail: 'ICMS, IPVA, ITCMD, taxas administrativas (fonte do Tesouro), FPE, IRRF, IPI-exportação e ICMS-desoneração (LC 87/1996), brutos',
    sign: '',
  },
  { key: 'municipalities', label: 'Municípios', detail: '25% do ICMS + 50% do IPVA + 25% do IPI-exportação', sign: '−' },
  { key: 'pasep', label: 'PASEP', detail: '1% do FPE', sign: '−' },
  { key: 'education', label: 'Educação (30%)', detail: '30% da receita da base menos a parte dos municípios', sign: '−' },
  { key: 'health', label: 'Saúde (12%)', detail: '12% da receita da base menos a parte dos municípios', sign: '−' },
  { key: 'netRevenue', label: 'Receita líquida', detail: 'Base dos percentuais da LDO', sign: '=' },
];

/** Percentual da LDO como a lei escreve: até duas casas (6,26%, 5%, 24,81%). */
function ldoPercent(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Diferença com sinal: positivo = a arrecadação gerou mais que os duodécimos. */
function signedCompact(value: number) {
  if (Math.abs(value) < 0.005) return compactMoney(0);
  return `${value > 0 ? '+' : '−'}${compactMoney(Math.abs(value))}`;
}

const DuodecimoTables = memo(function DuodecimoTables({
  summary,
  partialMonth,
}: {
  summary: DuodecimoSummary;
  partialMonth: number | null;
}) {
  const { branches, baseByMonth, baseClosed, closedMonths, months, impliedNetForecast } = summary;
  const lastClosed = closedMonths.at(-1);
  const untilLabel = lastClosed ? `até ${MONTHS_SHORT[lastClosed - 1]}` : 'no ano';
  const hasLoa = branches.some((branch) => branch.appropriation != null);
  const cell = 'px-2.5 py-2 text-right tabular-nums whitespace-nowrap';
  const money = (value: number | null, title?: string) => (
    <td className={cell} title={value == null ? undefined : (title ?? formatMoney(value))}>
      {value == null ? <span className="text-[#c3c6bf]">–</span> : compactMoney(value)}
    </td>
  );
  // Percentual efetivo ao lado do legal: abaixo da LDO em vermelho, acima em azul
  // (o par de alterações da dotação); o `title` diz a diferença em pontos.
  const effectiveCell = (effective: number | null, legal: number) => {
    if (effective == null) {
      return (
        <td className={cell}>
          <span className="text-[#c3c6bf]">–</span>
        </td>
      );
    }
    const gap = effective - legal;
    const flat = Math.abs(gap) < 0.005;
    const points = Math.abs(gap).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return (
      <td
        className={cell}
        title={`${ldoPercent(effective)} efetivo contra ${ldoPercent(legal)} na LDO: ${
          flat ? 'igual' : `${gap > 0 ? '+' : '−'}${points} ponto(s) percentual(is)`
        }`}
        style={{ color: flat ? undefined : gap < 0 ? CHANGE_TEXT_COLORS.reduction : CHANGE_TEXT_COLORS.increase }}
      >
        {ldoPercent(effective)}
      </td>
    );
  };
  const totals = branches.reduce(
    (total, branch) => ({
      appropriation: total.appropriation + (branch.appropriation ?? 0),
      updated: total.updated + (branch.updatedAppropriation ?? 0),
      monthly: total.monthly + (branch.monthlyInstallment ?? 0),
      installments: total.installments + (branch.installmentsClosed ?? 0),
      due: total.due + branch.dueClosed,
    }),
    { appropriation: 0, updated: 0, monthly: 0, installments: 0, due: 0 },
  );

  return (
    <>
      <div className="max-w-full overflow-x-auto [scrollbar-color:#c3c6bf_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b-2 border-[#141714] text-left">
              <th className="py-2 pr-3 font-semibold">Poder ou Instituição</th>
              <th className="px-2.5 py-2 text-right font-semibold" title="Percentual da receita líquida fixado na LDO">
                % na LDO
              </th>
              <th className="px-2.5 py-2 text-right font-semibold" title="Dotação inicial na fonte 100, como a LOA fixou">
                Dotação inicial (LOA)
              </th>
              <th
                className="px-2.5 py-2 text-right font-semibold"
                title="Dotação atualizada na fonte 100 no QDD: o orçamento disponibilizado, com os créditos suplementares"
              >
                Dotação atualizada
              </th>
              <th className="px-2.5 py-2 text-right font-semibold">Duodécimo</th>
              <th className="px-2.5 py-2 text-right font-semibold">Duodécimos {untilLabel}</th>
              <th
                className="px-2.5 py-2 text-right font-semibold"
                title="Duodécimos da LOA no período ÷ receita líquida realizada no mesmo período"
              >
                % efetivo
              </th>
              <th className="px-2.5 py-2 text-right font-semibold">Gerado pela arrecadação {untilLabel}</th>
              <th className="py-2 pl-2.5 text-right font-semibold">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.key} className="border-b border-[#ecede8]">
                <td className="py-2 pr-3">
                  {branch.label} <span className="text-[#80857f]">({branch.key})</span>
                </td>
                <td className={cell}>{ldoPercent(branch.percent)}</td>
                {money(branch.appropriation)}
                {money(branch.updatedAppropriation)}
                {money(branch.monthlyInstallment)}
                {money(branch.installmentsClosed)}
                {effectiveCell(branch.effectivePercent, branch.percent)}
                {money(branch.dueClosed)}
                <td className={cn(cell, 'pr-0')} title={branch.installmentsClosed == null ? undefined : formatMoney(branch.dueClosed - branch.installmentsClosed)}>
                  {branch.installmentsClosed == null ? (
                    <span className="text-[#c3c6bf]">–</span>
                  ) : (
                    signedCompact(branch.dueClosed - branch.installmentsClosed)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#141714] font-bold">
              <td className="py-2 pr-3">Total</td>
              <td className={cell}>{ldoPercent(summary.totalPercent)}</td>
              {money(hasLoa ? totals.appropriation : null)}
              {money(hasLoa ? totals.updated : null)}
              {money(hasLoa ? totals.monthly : null)}
              {money(hasLoa ? totals.installments : null)}
              {effectiveCell(summary.totalEffectivePercent, summary.totalPercent)}
              {money(totals.due)}
              <td className={cn(cell, 'pr-0')} title={hasLoa ? formatMoney(totals.due - totals.installments) : undefined}>
                {hasLoa ? signedCompact(totals.due - totals.installments) : <span className="text-[#c3c6bf]">–</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h4 className="mb-2 mt-8 text-sm font-semibold">Base de cálculo e valor gerado mês a mês (Anexo III)</h4>
      <div className="max-w-full overflow-x-auto [scrollbar-color:#c3c6bf_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[1100px] border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b-2 border-[#141714] text-left">
              <th className="sticky left-0 bg-white py-2 pr-3 font-semibold">Item</th>
              {months.map((month) => (
                <th key={month} className="px-2.5 py-2 text-right font-semibold capitalize">
                  {MONTHS_SHORT[month - 1]}
                  {month === partialMonth ? '*' : ''}
                </th>
              ))}
              <th className="px-2.5 py-2 text-right font-semibold">{lastClosed ? `Até ${MONTHS_SHORT[lastClosed - 1]}` : 'No ano'}</th>
              <th className="py-2 pl-2.5 text-right font-semibold">Prevista na LOA</th>
            </tr>
          </thead>
          <tbody>
            {BASE_LINES.map((line) => (
              <tr
                key={line.key}
                className={cn('border-b border-[#ecede8]', line.sign === '=' && 'bg-[#f5f6f2] font-semibold')}
              >
                <td
                  className={cn('sticky left-0 whitespace-nowrap py-2 pr-3', line.sign === '=' ? 'bg-[#f5f6f2]' : 'bg-white')}
                  title={line.detail}
                >
                  <span className="inline-block w-3 text-[#80857f]">{line.sign}</span> {line.label}
                </td>
                {months.map((month) => (
                  <Fragment key={month}>{money(baseByMonth[month - 1]![line.key])}</Fragment>
                ))}
                {money(baseClosed[line.key])}
                {line.key === 'netRevenue' ? (
                  money(impliedNetForecast, impliedNetForecast == null ? undefined : `${formatMoney(impliedNetForecast)}: dotações de fonte 100 dos Poderes ÷ ${ldoPercent(summary.totalPercent)}`)
                ) : (
                  <td className={cn(cell, 'pr-0')} />
                )}
              </tr>
            ))}
            {hasLoa ? (
              <tr className="border-b border-[#ecede8]">
                <td
                  className="sticky left-0 whitespace-nowrap bg-white py-2 pr-3"
                  title="Soma dos duodécimos da LOA no mês ÷ receita líquida realizada no mês"
                >
                  % efetivo dos duodécimos (LDO: {ldoPercent(summary.totalPercent)})
                </td>
                {months.map((month) => (
                  <Fragment key={month}>
                    {effectiveCell(summary.effectivePercentByMonth[month - 1] ?? null, summary.totalPercent)}
                  </Fragment>
                ))}
                {effectiveCell(summary.totalEffectivePercent, summary.totalPercent)}
                <td className={cn(cell, 'pr-0')} />
              </tr>
            ) : null}
            {branches.map((branch) => (
              <tr key={branch.key} className="border-b border-[#ecede8]">
                <td className="sticky left-0 whitespace-nowrap bg-white py-2 pl-[18px] pr-3" title={branch.label}>
                  {branch.key} ({ldoPercent(branch.percent)})
                </td>
                {months.map((month) => (
                  <Fragment key={month}>{money(branch.dueByMonth[month - 1]!)}</Fragment>
                ))}
                {money(branch.dueClosed)}
                {money(branch.appropriation)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
});

/**
 * Duodécimo dos Poderes e Instituições pela regra da LDO (contrato, seção 6.9): o
 * que a receita arrecadada gera para cada um, ao lado do duodécimo da LOA.
 */
function DuodecimoBlock({
  data,
  branchAppropriations,
}: {
  data: RevenueDto;
  branchAppropriations: BranchAppropriations | null;
}) {
  const appropriations =
    branchAppropriations && branchAppropriations.year === data.year ? branchAppropriations.byOrganization : null;
  const summary = summarizeDuodecimo(data.year, data.rows, data.months, data.partialMonth, appropriations);
  if (!summary) return null;

  const lastClosed = summary.closedMonths.at(-1);
  const due = summary.branches.reduce((total, branch) => total + branch.dueClosed, 0);
  const installments = summary.branches.reduce((total, branch) => total + (branch.installmentsClosed ?? 0), 0);
  const period = lastClosed ? `até ${MONTHS_LONG[lastClosed - 1]}` : 'no ano';

  return (
    <VizBlock
      title="Duodécimo dos Poderes e Instituições"
      summary={
        lastClosed ? (
          <>
            Pela {summary.rule.law}, a receita arrecadada {period} gera <b>{compactMoney(due)}</b> aos Poderes e
            Instituições ({ldoPercent(summary.totalPercent)} da receita líquida de {compactMoney(summary.baseClosed.netRevenue)}).
            {appropriations && summary.totalEffectivePercent != null ? (
              <>
                {' '}
                Os duodécimos do orçamento disponibilizado somam <b>{compactMoney(installments)}</b> no mesmo período, ou{' '}
                <b>{ldoPercent(summary.totalEffectivePercent)}</b> da receita líquida realizada, contra{' '}
                {ldoPercent(summary.totalPercent)} na LDO.
              </>
            ) : null}
          </>
        ) : (
          'Nenhum mês fechado ainda no exercício.'
        )
      }
    >
      <DuodecimoTables summary={summary} partialMonth={data.partialMonth} />
      <p className="mt-3 text-[12.5px] leading-normal text-[#80857f]">
        Regra da {summary.rule.law} e Anexo III: os percentuais incidem sobre a receita líquida, que é a receita da base
        menos a parte dos municípios, o PASEP e os 30% da educação e os 12% da saúde, calculados sobre a receita menos a
        parte dos municípios. Essa leitura foi conferida contra a LOA 2026: reproduz a receita líquida que ela usou para
        os Poderes, com diferença de 0,002%. Valores brutos de cada mês, como arrecadados; o mês em curso (*) fica fora do acumulado. Duodécimo =
        dotação atualizada de fonte 100 do Poder no QDD ÷ 12 (art. 168 da Constituição: as dotações com os créditos
        suplementares); a inicial fica ao lado para mostrar o que a LOA fixou.{' '}
        {appropriations
          ? null
          : `Para comparar com a LOA, selecione o exercício ${data.year} no cabeçalho. `}
        % efetivo = duodécimos no período ÷ receita líquida realizada no mesmo período: o quanto da receita o orçamento
        disponibilizado aos Poderes representa, para comparar com o % da LDO (em vermelho, abaixo dela; em azul,
        acima). Para os Poderes a liberação financeira acompanha o orçamento de fonte 100, então a dotação
        atualizada mede, na prática, o que eles recebem do Tesouro; a execução no QDD não serve para isso (o TJAC
        não executa pelo SICAF).
      </p>
    </VizBlock>
  );
}

// ── Seletor de ano ───────────────────────────────────────────────────────────

/**
 * Anos com receita coletada, do mais recente ao mais antigo. Só troca o ano
 * mostrado na aba: os dados de todos os anos já vieram na carga (R2).
 */
function YearSelector({
  years,
  value,
  onChange,
  pagePadding,
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  pagePadding: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-4 overflow-x-auto border-b border-[#e1e3dd] py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        pagePadding,
      )}
    >
      <span className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[#80857f]">
        Ano das receitas
      </span>
      <div role="group" aria-label="Ano das receitas" className="flex shrink-0 gap-4">
        {years.map((year) => (
          <button
            key={year}
            type="button"
            aria-pressed={year === value}
            onClick={() => onChange(year)}
            className={cn(
              'border-b-2 pb-0.5 text-sm tabular-nums transition-colors',
              year === value
                ? 'border-[#141714] font-semibold text-[#141714]'
                : 'border-transparent text-[#80857f] hover:text-[#141714]',
            )}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Painel ───────────────────────────────────────────────────────────────────

/**
 * Aba `Receitas` (contrato, seção 7.8): arrecadação do Estado por tributo e mês,
 * líquida das deduções, coletada toda semana do Portal da Transparência.
 */
export const RevenuePanel = memo(function RevenuePanel({
  data: summaries,
  error,
  pagePadding,
  defaultYear,
  branchAppropriations,
}: {
  /** Um resumo por ano coletado, do mais recente ao mais antigo; `undefined` enquanto carrega. */
  data: RevenueDto[] | undefined;
  error: string | null;
  pagePadding: string;
  /** Ano mostrado de início: o exercício do painel, se tiver receita; senão o mais recente. */
  defaultYear: number | null;
  /** Dotação de fonte 100 dos Poderes no QDD carregado (duodécimo); `null` sem QDD. */
  branchAppropriations: BranchAppropriations | null;
}) {
  // Escolha explícita do usuário; sem ela, segue `defaultYear` (que muda com o exercício).
  const [pickedYear, setPickedYear] = useState<number | null>(null);

  if (error) {
    return (
      <div className={cn('py-8', pagePadding)}>
        <VizEmpty>Receitas indisponíveis: {error} O restante do painel segue disponível.</VizEmpty>
      </div>
    );
  }
  if (summaries === undefined) {
    return (
      <div className={cn('grid gap-6 py-8', pagePadding)}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (!summaries.length) {
    return (
      <div className={cn('py-8', pagePadding)}>
        <VizEmpty>A coleta semanal do Portal da Transparência ainda não gravou nenhuma receita.</VizEmpty>
      </div>
    );
  }

  const years = summaries.map((summary) => summary.year);
  const year = [pickedYear, defaultYear].find((candidate) => candidate != null && years.includes(candidate)) ?? years[0];
  const data = summaries.find((summary) => summary.year === year)!;
  const previous = summaries.find((summary) => summary.year === year - 1);

  const collectedAt = new Date(data.collectedAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <>
      <YearSelector years={years} value={year} onChange={setPickedYear} pagePadding={pagePadding} />
      <RevenueStrip data={data} previous={previous} />
      <div className={cn('grid gap-x-12 gap-y-10 py-8', pagePadding)}>
        {/* Sem frases de leitura nos dois blocos (pedido do dono do produto): o que
            importa já está na régua e na própria tabela; a nota de rodapé explica. */}
        <VizBlock title="Arrecadação mês a mês">
          <MonthlyColumns data={data} />
        </VizBlock>
        <VizBlock title="Receita por tributo">
          <RevenueTable data={data} />
          <p className="mt-3 text-[12.5px] leading-normal text-[#80857f]">
            {data.partialMonth ? '* Mês em curso, ainda recebendo arrecadação. ' : ''}
            Valores líquidos das deduções; passe o mouse numa célula para ver o bruto.{' '}
            Fonte: Portal da Transparência do Acre (receitas por natureza), coletado em {collectedAt} (atualização semanal). A dedução para
            o FUNDEB é abatida do tributo de origem (ICMS, IPVA, ITCMD, FPE); o FUNDEB recebido aparece em
            Transferências. As intraorçamentárias circulam entre órgãos do próprio Estado e entram no total, como no
            portal.
          </p>
        </VizBlock>
        <DuodecimoBlock data={data} branchAppropriations={branchAppropriations} />
      </div>
    </>
  );
});
