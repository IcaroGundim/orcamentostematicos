'use client';

import { memo, useMemo, useState } from 'react';
import { CalendarDaysIcon, DatabaseIcon, UsersIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PayrollGroupDto {
  key: string;
  secondaryKey: string | null;
  headcount: number;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
}

export interface PayrollDto {
  snapshot: {
    year: number;
    month: number;
    collectedAt: string;
    headcount: number;
    portalHeadcount: number;
    grossTotal: number;
    deductionsTotal: number;
    netTotal: number;
  } | null;
  byContractType: PayrollGroupDto[];
  byOrganization: PayrollGroupDto[];
  byCareer: PayrollGroupDto[];
  byOrganizationContract: PayrollGroupDto[];
}

const MONTHS = [
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

const PAYROLL_COLORS = ['#5f8f70', '#8fa873', '#b8b477', '#110f24', '#c8c89f'] as const;
const PAYROLL_PIE_COLORS = [
  '#365f47',
  '#5f8f70',
  '#78966a',
  '#8fa873',
  '#b8b477',
  '#8c8756',
  '#29253d',
  '#110f24',
  '#d8d8bd',
  '#6f735a',
] as const;

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} bi`;
  }
  if (absolute >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mi`;
  }
  if (absolute >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 0,
    })} mil`;
  }
  return formatMoney(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function careerFamilyLabel(value: string) {
  let label = value
    .toUpperCase()
    .normalize('NFC')
    .replace(/\bCALSSE\b/g, 'CLASSE')
    .replace(/\s+/g, ' ')
    .trim();

  label = label
    .replace(/\s*-?\s*CLASSE\s+(?:ESPECIAL|[IVXLCDM]+|\d+|[A-Z])\b/g, ' ')
    .replace(/\s+N[IÍ]VEL\s+(?:[IVXLCDM]+|\d+|[A-Z])\b/g, ' ')
    .replace(/\s+N\s+(?:[IVXLCDM]+|\d+)\b/g, ' ')
    .replace(/\b\d{1,2}\s*H(?:ORAS)?\b/g, ' ')
    .replace(/\b\d{1,2}\s+HORAS\b/g, ' ')
    .replace(/\s*-\s*EM EXTIN[CÇ][AÃ]O\b/g, ' ')
    .replace(/\s+-\s+MODELO\s+\d+\b/g, ' ')
    .replace(/\bCONT\s+TEMP\b/g, ' ')
    .replace(/\s+(?:JR|JUNIOR|PL|PLENO|SR|SENIOR)(?:\s+[IVXLCDM]+)?\s*$/g, '')
    .replace(/(?:\s+(?:[IVXLCDM]+|\d+))+?\s*$/g, '');

  if (/^PROFESSOR\b/.test(label)) {
    label = 'PROFESSOR';
  } else {
    label = label
      .replace(/^ESPEC\.\s+EM\s+EDUC\./, 'ESPECIALISTA EM EDUCAÇÃO')
      .replace(/^TECNICO\s+ADM\.\s+EDUC\./, 'TÉCNICO ADMINISTRATIVO EDUCACIONAL')
      .replace(/^APOIO\s+ADMIN\./, 'APOIO ADMINISTRATIVO');
  }

  return label
    .replace(/\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function careerFamilyKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function PayrollSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 overflow-hidden border bg-white', className)}>
      <h3 className="bg-green-900 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </h3>
      <div className="min-w-0 p-3">{children}</div>
    </section>
  );
}

function PayrollSummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-base font-bold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PayrollBarList({
  rows,
  total,
  emptyLabel,
  limit = 8,
}: {
  rows: PayrollGroupDto[];
  total: number;
  emptyLabel: string;
  limit?: number;
}) {
  const sortedRows = useMemo(
    () => [...rows].filter((row) => row.grossTotal > 0).sort((a, b) => b.grossTotal - a.grossTotal),
    [rows],
  );
  const visibleRows = sortedRows.slice(0, limit);

  if (!visibleRows.length) {
    return (
      <div className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-2.5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Participação na folha bruta
        {sortedRows.length > visibleRows.length
          ? ` · exibindo os ${visibleRows.length} maiores de ${sortedRows.length}`
          : ''}
        .
      </p>
      {visibleRows.map((row, index) => {
        const share = total ? (row.grossTotal / total) * 100 : 0;
        return (
          <div key={`${row.key}|${row.secondaryKey ?? ''}`} className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium" title={row.key}>
                {row.key}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {compactMoney(row.grossTotal)}
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div
                className="h-1.5 overflow-hidden bg-stone-100"
                role="img"
                aria-label={`${row.key}: ${formatPercent(share)} da folha bruta`}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(share > 0 ? 1 : 0, Math.min(100, share))}%`,
                    backgroundColor: PAYROLL_COLORS[index % PAYROLL_COLORS.length],
                  }}
                />
              </div>
              <span className="w-32 text-right text-xs tabular-nums text-muted-foreground">
                {row.headcount.toLocaleString('pt-BR')} vínc. · {formatPercent(share)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const switchTrackClass =
  'group relative inline-block h-[1.5em] w-[2.6em] shrink-0 cursor-pointer rounded-[8px] bg-[rgb(182,182,182)] text-[15px] outline-none transition-colors duration-[400ms] focus-visible:shadow-[0_0_1px_#2196F3] data-[state=checked]:bg-[#166534]';
const switchThumbClass =
  'absolute bottom-[0.22em] left-[0.22em] size-[1.06em] rounded-[6px] bg-white transition-transform duration-[400ms] group-data-[state=checked]:translate-x-[1.1em]';

function AverageEarningsByCareerList({
  rows,
}: {
  rows: PayrollGroupDto[];
}) {
  /**
   * Aposentados e pensionistas distorcem a média por carreira (entram com o cargo de
   * origem, mas com proventos de inatividade). O padrão é escondê-los; o toggle
   * permite ver o quadro completo. A marca ATIVO/INATIVO vem de `secondaryKey`.
   */
  const [includeInactive, setIncludeInactive] = useState(false);

  // `secondaryKey` traz a situação crua do portal (ATIVO, INATIVO, PENSIONISTA,
  // EXONERADO/RESCISO). Ativo é só o primeiro; o resto entra apenas com o toggle.
  const visibleRows = useMemo(
    () => (includeInactive ? rows : rows.filter((row) => row.secondaryKey === 'ATIVO')),
    [rows, includeInactive],
  );

  const inactiveHeadcount = useMemo(
    () =>
      rows
        .filter((row) => row.secondaryKey !== 'ATIVO')
        .reduce((total, row) => total + row.headcount, 0),
    [rows],
  );

  const rankedRows = useMemo(
    () => {
      const families = new Map<
        string,
        {
          key: string;
          label: string;
          headcount: number;
          grossTotal: number;
          variantCount: number;
        }
      >();

      for (const row of visibleRows) {
        if (row.headcount <= 0 || row.grossTotal <= 0) continue;
        const label = careerFamilyLabel(row.key);
        const key = careerFamilyKey(label);
        const family = families.get(key) ?? {
          key,
          label,
          headcount: 0,
          grossTotal: 0,
          variantCount: 0,
        };
        family.headcount += row.headcount;
        family.grossTotal += row.grossTotal;
        family.variantCount += 1;
        families.set(key, family);
      }

      return [...families.values()]
        .map((row) => ({
          ...row,
          averageEarnings: row.grossTotal / row.headcount,
        }))
        .sort(
          (a, b) =>
            b.averageEarnings - a.averageEarnings ||
            b.headcount - a.headcount,
        );
    },
    [visibleRows],
  );
  const highestAverage = rankedRows[0]?.averageEarnings ?? 0;

  const toggle = (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium select-none">
      Incluir inativos
      <button
        type="button"
        role="switch"
        aria-checked={includeInactive}
        aria-label="Incluir aposentados e pensionistas no ranking de carreiras"
        data-state={includeInactive ? 'checked' : 'unchecked'}
        onClick={() => setIncludeInactive((value) => !value)}
        className={switchTrackClass}
      >
        <span aria-hidden className={switchThumbClass} />
      </button>
    </label>
  );

  if (!rankedRows.length) {
    return (
      <div className="grid min-w-0 gap-2.5">
        <div className="flex items-center justify-end">{toggle}</div>
        <div className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
          Nenhuma carreira disponível.
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-2.5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          Rendimento bruto médio por vínculo, consolidando classes, níveis e jornadas ·{' '}
          {rankedRows.length.toLocaleString('pt-BR')} carreiras ·{' '}
          {includeInactive
            ? `inativos incluídos (${inactiveHeadcount.toLocaleString('pt-BR')} vínculos)`
            : `${inactiveHeadcount.toLocaleString('pt-BR')} vínculos inativos ocultos`}
          .
        </p>
        {toggle}
      </div>
      <div
        className="max-h-[22rem] min-w-0 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]"
        tabIndex={0}
        aria-label="Todas as carreiras ordenadas por rendimento bruto médio"
      >
        <div className="grid min-w-0 gap-2.5">
          {rankedRows.map((row, index) => {
            const relativeWidth = highestAverage
              ? (row.averageEarnings / highestAverage) * 100
              : 0;
            return (
              <div key={row.key} className="grid min-w-0 gap-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                  <span
                    className="min-w-0 flex-1 truncate font-medium"
                    title={
                      row.variantCount > 1
                        ? `${row.label} · ${row.variantCount} denominações consolidadas`
                        : row.label
                    }
                  >
                    {row.label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(row.averageEarnings)}
                  </span>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div
                    className="h-1.5 overflow-hidden bg-stone-100"
                    role="img"
                    aria-label={`${row.label}: rendimento bruto médio de ${formatMoney(row.averageEarnings)}`}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(
                          relativeWidth > 0 ? 1 : 0,
                          Math.min(100, relativeWidth),
                        )}%`,
                        backgroundColor: PAYROLL_COLORS[index % PAYROLL_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                    {row.headcount.toLocaleString('pt-BR')} vínc.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type OrganizationPieRow = {
  name: string;
  value: number;
  headcount: number;
  organizationCount: number;
};

function OrganizationPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: OrganizationPieRow }>;
  total: number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const share = total ? (row.value / total) * 100 : 0;

  return (
    <div className="max-w-80 border border-black/60 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-semibold">{row.name}</p>
      <p className="mt-1 text-sm font-bold tabular-nums">{formatMoney(row.value)}</p>
      <p className="text-xs text-muted-foreground">
        {formatPercent(share)} da folha bruta · {row.headcount.toLocaleString('pt-BR')}{' '}
        vínculo(s)
      </p>
    </div>
  );
}

function OrganizationPayrollPie({
  rows,
  total,
}: {
  rows: PayrollGroupDto[];
  total: number;
}) {
  const chartData = useMemo(() => {
    const sortedRows = [...rows]
      .filter((row) => row.grossTotal > 0)
      .sort((a, b) => b.grossTotal - a.grossTotal);
    const visibleRows = sortedRows.slice(0, 9);
    const remainingRows = sortedRows.slice(9);
    const result: OrganizationPieRow[] = visibleRows.map((row) => ({
      name: row.key,
      value: row.grossTotal,
      headcount: row.headcount,
      organizationCount: 1,
    }));

    if (remainingRows.length) {
      result.push({
        name: `Demais órgãos (${remainingRows.length})`,
        value: remainingRows.reduce((sum, row) => sum + row.grossTotal, 0),
        headcount: remainingRows.reduce((sum, row) => sum + row.headcount, 0),
        organizationCount: remainingRows.length,
      });
    }
    return result;
  }, [rows]);
  const distributionTotal =
    total || chartData.reduce((sum, row) => sum + row.value, 0);

  if (!chartData.length) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        Nenhum órgão disponível para compor o gráfico.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] lg:divide-x">
      <div className="h-72 min-w-0 lg:pr-5">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="88%"
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive
            >
              {chartData.map((row, index) => (
                <Cell
                  key={row.name}
                  fill={PAYROLL_PIE_COLORS[index % PAYROLL_PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <OrganizationPieTooltip total={distributionTotal} />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="min-w-0 lg:pl-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Participação na folha bruta
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Nove maiores órgãos; os demais são consolidados em uma única fatia.
            </p>
          </div>
          <strong className="text-base tabular-nums">
            {formatMoney(distributionTotal)}
          </strong>
        </div>
        <div className="grid min-w-0 gap-px border bg-black/20 sm:grid-cols-2">
          {chartData.map((row, index) => {
            const share = distributionTotal ? (row.value / distributionTotal) * 100 : 0;
            return (
              <div
                key={row.name}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-white px-3 py-2"
              >
                <span
                  className="size-3"
                  aria-hidden="true"
                  style={{
                    backgroundColor:
                      PAYROLL_PIE_COLORS[index % PAYROLL_PIE_COLORS.length],
                  }}
                />
                <span className="truncate text-xs font-medium" title={row.name}>
                  {row.name}
                </span>
                <span className="text-right text-xs font-semibold tabular-nums">
                  {formatPercent(share)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContractTypeTable({ rows }: { rows: PayrollGroupDto[] }) {
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.grossTotal - a.grossTotal),
    [rows],
  );

  return (
    <div className="min-w-0 overflow-auto border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-stone-50">
          <TableRow className="border-b border-black/70">
            <TableHead>Tipo de vínculo</TableHead>
            <TableHead className="text-right">Vínculos</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Descontos</TableHead>
            <TableHead className="text-right">Líquido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.key} className="odd:bg-stone-50/60">
              <TableCell className="font-medium">{row.key}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.headcount.toLocaleString('pt-BR')}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(row.grossTotal)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(row.deductionsTotal)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(row.netTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrganizationContractTable({ rows }: { rows: PayrollGroupDto[] }) {
  const visibleRows = useMemo(
    () => [...rows].sort((a, b) => b.grossTotal - a.grossTotal).slice(0, 12),
    [rows],
  );

  return (
    <div className="min-w-0 overflow-auto border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-stone-50">
          <TableRow className="border-b border-black/70">
            <TableHead>Órgão</TableHead>
            <TableHead>Tipo de vínculo</TableHead>
            <TableHead className="text-right">Vínculos</TableHead>
            <TableHead className="text-right">Folha bruta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow
              key={`${row.key}|${row.secondaryKey ?? ''}`}
              className="odd:bg-stone-50/60"
            >
              <TableCell className="max-w-72 truncate font-medium" title={row.key}>
                {row.key}
              </TableCell>
              <TableCell>{row.secondaryKey || 'Não informado'}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.headcount.toLocaleString('pt-BR')}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(row.grossTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Memoizado porque a aba de folha fica montada junto com as demais (`forceMount`) —
 * sem isso, ela re-renderizaria a cada troca de aba, métrica ou filtro do QDD, que
 * nem sequer se aplicam a este painel.
 */
export const PayrollPanel = memo(function PayrollPanel({ data }: { data: PayrollDto }) {
  if (!data.snapshot) {
    return (
      <div className="flex h-full min-h-0 border bg-white">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Folha ainda não coletada</EmptyTitle>
            <EmptyDescription>
              A coleta roda diariamente de madrugada. Também é possível disparar o
              workflow &quot;Coleta da folha de pagamento&quot; manualmente no GitHub.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const { snapshot } = data;
  const unclassified = Math.max(0, snapshot.portalHeadcount - snapshot.headcount);
  const period = `${MONTHS[snapshot.month - 1] ?? snapshot.month} de ${snapshot.year}`;
  const collectedAt = new Date(snapshot.collectedAt).toLocaleDateString('pt-BR');
  const summary = [
    { label: 'Vínculos classificados', value: snapshot.headcount.toLocaleString('pt-BR') },
    { label: 'Folha bruta', value: formatMoney(snapshot.grossTotal) },
    { label: 'Descontos', value: formatMoney(snapshot.deductionsTotal) },
    { label: 'Folha líquida', value: formatMoney(snapshot.netTotal) },
  ];

  return (
    <div className="payroll-presentation flex h-full min-h-0 flex-col overflow-hidden border bg-white">
      <header className="shrink-0 border-b bg-white px-4 py-3">
        <h2 className="text-lg font-bold leading-tight text-green-900">Folha de pagamento</h2>
        <p className="mt-0.5 text-sm font-semibold capitalize">{period}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDaysIcon className="size-3.5" />
            Coleta atualizada em {collectedAt}
          </span>
          <span className="inline-flex items-center gap-1">
            <DatabaseIcon className="size-3.5" />
            Portal da Transparência do Acre
          </span>
          <span>Somente dados agregados</span>
        </div>
        {unclassified > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {unclassified.toLocaleString('pt-BR')} vínculo(s) sem tipo de contrato definido
            permanecem apenas no total informado pelo portal.
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid gap-3">
          <dl className="grid grid-cols-2 gap-px border border-black/70 bg-black lg:grid-cols-4">
            {summary.map((item) => (
              <PayrollSummaryMetric key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>

          <PayrollSection title="Distribuição do total da folha por órgão">
            <OrganizationPayrollPie
              rows={data.byOrganization}
              total={snapshot.grossTotal}
            />
          </PayrollSection>

          <PayrollSection title="Distribuição da folha">
            <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3 xl:divide-x">
              <div className="min-w-0 xl:pr-5">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Por tipo de vínculo
                </h4>
                <PayrollBarList
                  rows={data.byContractType}
                  total={snapshot.grossTotal}
                  emptyLabel="Nenhum tipo de vínculo disponível"
                />
              </div>
              <div className="min-w-0 xl:px-5">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Por órgão
                </h4>
                <PayrollBarList
                  rows={data.byOrganization}
                  total={snapshot.grossTotal}
                  emptyLabel="Nenhum órgão disponível"
                />
              </div>
              <div className="min-w-0 xl:pl-5">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Maiores carreiras por rendimento médio
                </h4>
                <AverageEarningsByCareerList rows={data.byCareer} />
              </div>
            </div>
          </PayrollSection>

          <PayrollSection title="Detalhamento da folha">
            <div className="grid min-w-0 grid-cols-1 gap-5 2xl:grid-cols-[0.9fr_1.4fr] 2xl:divide-x">
              <div className="min-w-0 2xl:pr-5">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Totais por tipo de vínculo
                </h4>
                <ContractTypeTable rows={data.byContractType} />
              </div>
              <div className="min-w-0 2xl:pl-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Maiores folhas por órgão e vínculo
                  </h4>
                  <span className="text-xs text-muted-foreground">12 maiores combinações</span>
                </div>
                <OrganizationContractTable rows={data.byOrganizationContract} />
              </div>
            </div>
          </PayrollSection>
        </div>
      </div>
    </div>
  );
});
