'use client';

/**
 * Régua de indicadores, blocos e gráficos da execução orçamentária, desenhados à mão
 * em SVG (contrato, seção 7.7). Uma forma por tipo de dado: anel para percentual,
 * rosca e quadradinhos para composição, mapa de áreas para tamanho com uma segunda
 * leitura, pirulito para ranking, halteres para a mudança da dotação e dispersão para
 * dotação × execução. A geometria mora em `src/lib/chart-geometry.ts`; as cores, em
 * `src/lib/chart-palette.ts`.
 */

import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/api';
import {
  CHANGE_COLORS,
  CHANGE_TEXT_COLORS,
  CHART_OTHER,
  SEQUENTIAL_EXECUTION,
  STAGE_COLORS,
} from '@/lib/chart-palette';
import { donutArcs, shareOf, squarify, waffleCells } from '@/lib/chart-geometry';
import type { BudgetChangeRow, ExecutionRow, ExecutionTotals } from '@/lib/execution-monitor';
import {
  compactAxis,
  compactMoney,
  formatPercent,
  signedCompactMoney,
  signedMoney,
} from '@/lib/number-format';
import { readableName, withoutCode } from '@/lib/readable-name';
import { cn } from '@/lib/utils';

const INK = '#141714';
const INK_2 = '#4a504b';
const INK_3 = '#80857f';
const TRACK = '#e3e5df';
const GRID = '#ecede8';

// ── Caixa de detalhe ─────────────────────────────────────────────────────────

export type TooltipRow =
  | { label: string; value: string; color?: string; marker?: 'dot' | 'ring' | 'square' }
  | 'divider';

export interface TooltipData {
  /** Linha pequena acima do título ("Órgão 744"). */
  sub?: string;
  title: string;
  /** Número principal, em destaque. */
  big?: { label: string; value: string; color?: string };
  rows: TooltipRow[];
  note?: string;
}

/**
 * "744 — SECRETARIA DE …" vira subtítulo "Órgão 744" + nome em caixa normal; os demais
 * códigos (elemento, fonte, ação) viram "Código 11".
 */
function splitCodedTitle(title: string): { sub?: string; title: string } {
  const coded = /^(\d{1,8}) — (.+)$/.exec(title);
  if (!coded) return { title: readableName(title) };
  const [, code, name] = coded;
  return { sub: `${code!.length === 3 ? 'Órgão' : 'Código'} ${code}`, title: readableName(name) };
}

function Marker({ color, kind = 'square' }: { color?: string; kind?: 'dot' | 'ring' | 'square' }) {
  if (!color) return null;
  if (kind === 'ring') {
    return <i aria-hidden className="inline-block size-2.5 shrink-0 rounded-full border-2 bg-white" style={{ borderColor: color }} />;
  }
  return (
    <i
      aria-hidden
      className={cn('inline-block size-[9px] shrink-0', kind === 'dot' && 'rounded-full')}
      style={{ backgroundColor: color }}
    />
  );
}

function ChartTooltip({ data, boxRef }: { data: TooltipData; boxRef: React.Ref<HTMLDivElement> }) {
  const heading = data.sub ? { sub: data.sub, title: data.title } : splitCodedTitle(data.title);
  return (
    <div
      ref={boxRef}
      role="tooltip"
      className="pointer-events-none fixed left-0 top-0 z-[80] w-[310px] border border-[#141714] bg-white px-3.5 pb-3 pt-3 text-[13px] leading-snug text-[#141714] shadow-[0_8px_20px_rgba(20,23,20,0.12)]"
    >
      {heading.sub ? (
        <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#80857f]">
          {heading.sub}
        </span>
      ) : null}
      <span className="block text-sm font-semibold leading-tight">{heading.title}</span>
      {data.big ? (
        <div
          className="mt-2.5 text-2xl font-bold leading-none tracking-tight tabular-nums"
          style={{ color: data.big.color }}
        >
          {data.big.value}
          <small className="mt-1 block text-[11.5px] font-medium tracking-normal text-[#80857f]">
            {data.big.label}
          </small>
        </div>
      ) : null}
      {data.rows.length ? (
        <div className="mt-3 grid gap-1.5 border-t border-[#e1e3dd] pt-2.5">
          {data.rows.map((row, index) =>
            row === 'divider' ? (
              <hr key={`divider-${index}`} className="my-0.5 border-[#e1e3dd]" />
            ) : (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-[#4a504b]">
                  <Marker color={row.color} kind={row.marker} />
                  {row.label}
                </span>
                <b className="whitespace-nowrap font-semibold tabular-nums">{row.value}</b>
              </div>
            ),
          )}
        </div>
      ) : null}
      {data.note ? <p className="mt-2.5 text-[11.5px] leading-snug text-[#80857f]">{data.note}</p> : null}
    </div>
  );
}

/**
 * Uma caixa de detalhe por gráfico. O conteúdo vai para o estado só ao entrar num
 * item; ao mover o mouse, a posição é escrita direto no elemento, para não
 * re-renderizar o gráfico a cada pixel.
 */
export function useChartTooltip() {
  const [data, setData] = useState<TooltipData | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });

  const place = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const { x, y } = position.current;
    box.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${Math.max(8, Math.min(y + 14, window.innerHeight - box.offsetHeight - 8))}px`;
  }, []);

  useLayoutEffect(() => {
    if (data) place();
  }, [data, place]);

  const bind = useCallback(
    (content: TooltipData) => ({
      onMouseEnter: (event: ReactMouseEvent) => {
        position.current = { x: event.clientX, y: event.clientY };
        setData(content);
      },
      onMouseMove: (event: ReactMouseEvent) => {
        position.current = { x: event.clientX, y: event.clientY };
        place();
      },
      onMouseLeave: () => setData(null),
    }),
    [place],
  );

  const tooltip = data ? <ChartTooltip data={data} boxRef={boxRef} /> : null;
  return { bind, tooltip };
}

/**
 * Largura do conteúdo de `ref`, para o SVG desenhar na largura real do card (escala
 * 1:1, fontes no tamanho nominal). Até a primeira medida vale `fallback`, que o
 * `viewBox` escala.
 */
export function useMeasuredWidth(ref: React.RefObject<HTMLElement | null>, fallback: number): number {
  const [measured, setMeasured] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setMeasured(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return measured && measured > 0 ? measured : fallback;
}

// ── Peças pequenas ───────────────────────────────────────────────────────────

/** Anel de percentual (0–100). */
export function Ring({
  value,
  size = 26,
  width = 4,
  color = STAGE_COLORS.liquidated,
}: {
  value: number;
  size?: number;
  width?: number;
  color?: string;
}) {
  const radius = size / 2 - width / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" stroke={TRACK} strokeWidth={width} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}

/** Rótulo pequeno em caixa alta espaçada, o mesmo da régua e dos blocos. */
export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'block text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[#80857f]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Estado vazio de um bloco: texto concreto do que falta, sem ilustração. */
export function VizEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-32 items-center justify-center border border-dashed border-[#c3c6bf] px-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Bloco da grade: faixa de título no verde da marca, frase de leitura e o gráfico. */
export function VizBlock({
  title,
  summary,
  children,
  className,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('fiscal-print-section min-w-0 pb-2', className)}>
      <h3 className="bg-marca px-3.5 py-2.5 text-sm font-semibold tracking-[0.02em] text-marca-contraste">
        {title}
      </h3>
      {summary ? (
        <p className="mb-4 mt-3 min-h-10 text-[13.5px] leading-normal text-[#4a504b] [&_b]:font-semibold [&_b]:text-[#141714] [&_b]:tabular-nums">
          {summary}
        </p>
      ) : (
        <div className="h-4" />
      )}
      {children}
    </section>
  );
}

// ── Régua de indicadores ─────────────────────────────────────────────────────

function KpiCell({
  label,
  value,
  detail,
  rate,
  color,
  isLoading,
}: {
  label: string;
  value: number;
  detail: string;
  rate?: number;
  color?: string;
  isLoading?: boolean;
}) {
  return (
    <div>
      <MicroLabel>{label}</MicroLabel>
      {isLoading ? (
        <Skeleton className="mt-2 h-5 w-36" />
      ) : (
        <>
          <div className="kpi-value mt-1.5 whitespace-nowrap text-[14px] font-semibold tracking-tight tabular-nums sm:text-[17px]">
            {formatMoney(value)}
          </div>
          <div className="mt-1.5 flex min-w-0 items-center gap-[7px] whitespace-nowrap text-[13px] text-[#4a504b] tabular-nums">
            {rate != null ? <Ring value={rate} size={20} color={color} /> : null}
            <span className="truncate" title={detail}>
              {detail}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Seis indicadores numa linha (contrato, seção 3.4): execução em destaque e cada
 * estágio com o anel do seu percentual. Valores por extenso, nunca compactos.
 */
export const KpiStrip = memo(function KpiStrip({
  totals,
  isLoading,
  amendments,
  className,
}: {
  totals: ExecutionTotals;
  isLoading?: boolean;
  amendments?: boolean;
  className?: string;
}) {
  const executed = shareOf(totals.liquidated, totals.updatedBudget);
  const credits = totals.updatedBudget - totals.initialBudget;
  return (
    <section
      aria-label="Indicadores do recorte"
      className={cn(
        // Colunas e filetes em `.orcamento-kpis` (globals.css): o Tailwind ordenava
        // `min-[1360px]:` antes de `sm:` e a régua nunca chegava às seis colunas.
        'orcamento-kpis grid gap-y-6 border-b border-[#e1e3dd] bg-[#f5f6f2] px-6 py-6 xl:px-10',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {isLoading ? (
          <Skeleton className="size-[70px] rounded-full" />
        ) : (
          <Ring value={executed} size={70} width={9} color={STAGE_COLORS.liquidated} />
        )}
        <div className="min-w-0">
          <MicroLabel>{amendments ? 'Execução · emendas' : 'Execução'}</MicroLabel>
          {isLoading ? (
            <Skeleton className="mt-2 h-9 w-24" />
          ) : (
            <div className="kpi-main-value mt-1.5 text-[40px] font-bold leading-none tracking-[-0.025em] tabular-nums">
              {formatPercent(executed)}
            </div>
          )}
          <div className="mt-1.5 text-[13px] text-[#4a504b]">liquidado ÷ dotação</div>
        </div>
      </div>
      <KpiCell label="Dotação inicial" value={totals.initialBudget} detail="lei orçamentária" isLoading={isLoading} />
      <KpiCell
        label="Dotação atualizada"
        value={totals.updatedBudget}
        detail={`${signedMoney(credits)} em créditos`}
        isLoading={isLoading}
      />
      <KpiCell
        label="Empenhado"
        value={totals.committed}
        rate={shareOf(totals.committed, totals.updatedBudget)}
        color={STAGE_COLORS.committed}
        detail={`${formatPercent(shareOf(totals.committed, totals.updatedBudget))} da dotação`}
        isLoading={isLoading}
      />
      <KpiCell
        label="Liquidado"
        value={totals.liquidated}
        rate={executed}
        color={STAGE_COLORS.liquidated}
        detail={`${formatPercent(executed)} da dotação`}
        isLoading={isLoading}
      />
      <KpiCell
        label="Pago"
        value={totals.paid}
        rate={shareOf(totals.paid, totals.liquidated)}
        color={STAGE_COLORS.paid}
        detail={`${formatPercent(shareOf(totals.paid, totals.liquidated))} do liquidado`}
        isLoading={isLoading}
      />
    </section>
  );
});

// ── Composição ───────────────────────────────────────────────────────────────

export interface ColoredItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Legenda de composição: cor, nome, valor compacto e parcela. */
export function ShareLegend({
  items,
  total,
  showValue = true,
  className,
}: {
  items: ColoredItem[];
  total: number;
  showValue?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid min-w-0 gap-2 text-[13px]', className)}>
      {items.map((item) => (
        <div key={item.key} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-baseline">
          <i aria-hidden className="mr-2 inline-block size-2.5 self-center" style={{ backgroundColor: item.color }} />
          <span className="truncate pr-3" title={item.label}>
            {item.label}
          </span>
          <span className="whitespace-nowrap text-[#4a504b] tabular-nums">
            {showValue ? compactMoney(item.value) : null}
            <b className={cn('font-semibold text-[#141714]', showValue && 'ml-2')}>
              {formatPercent(shareOf(item.value, total))}
            </b>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Rosca com o total (ou o destaque) no centro. */
export const DonutChart = memo(function DonutChart({
  items,
  total,
  center,
  caption,
  size = 200,
  label,
}: {
  items: ColoredItem[];
  total: number;
  center: string;
  caption: string;
  size?: number;
  label: string;
}) {
  const { bind, tooltip } = useChartTooltip();
  const radius = size / 2 - 22;
  const circumference = 2 * Math.PI * radius;
  const middle = size / 2;
  const arcs = donutArcs(items, total);
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
        <circle cx={middle} cy={middle} r={radius} fill="none" stroke={TRACK} strokeWidth={34} />
        {arcs.map((arc) => {
          const length = circumference * arc.share;
          return (
            <circle
              key={arc.item.key}
              cx={middle}
              cy={middle}
              r={radius}
              fill="none"
              stroke={arc.item.color}
              strokeWidth={34}
              // 2px de folga entre fatias; fatia menor que isso fica com 0,5px.
              strokeDasharray={`${Math.max(0.5, length - 2)} ${circumference}`}
              strokeDashoffset={-circumference * arc.start}
              transform={`rotate(-90 ${middle} ${middle})`}
              {...bind({
                title: arc.item.label,
                big: { label: 'da dotação', value: formatPercent(arc.share * 100), color: arc.item.color },
                rows: [{ label: 'Dotação atualizada', value: formatMoney(arc.item.value) }],
              })}
            />
          );
        })}
        <text x={middle} y={middle - 2} textAnchor="middle" fontSize={Math.round(size * 0.085)} fontWeight={700} fill={INK}>
          {center}
        </text>
        <text x={middle} y={middle + size * 0.085} textAnchor="middle" fontSize={12} fill={INK_2}>
          {caption}
        </text>
      </svg>
      {tooltip}
    </>
  );
});

/** Grade de 100 quadradinhos: cada um vale 1% do total. */
export const WaffleChart = memo(function WaffleChart({
  items,
  total,
  label,
}: {
  items: ColoredItem[];
  total: number;
  label: string;
}) {
  const { bind, tooltip } = useChartTooltip();
  const cells = waffleCells(
    items.map((item) => item.value),
    total,
  );
  return (
    <>
      <div role="img" aria-label={label} className="grid max-w-[240px] grid-cols-10 gap-[3px]">
        {items.flatMap((item, index) => {
          const handlers = bind({
            title: item.label,
            big: { label: 'da dotação', value: formatPercent(shareOf(item.value, total)), color: item.color },
            rows: [{ label: 'Dotação atualizada', value: formatMoney(item.value) }],
          });
          return Array.from({ length: cells[index] ?? 0 }, (_, cell) => (
            <i
              key={`${item.key}-${cell}`}
              className="block aspect-square"
              style={{ backgroundColor: item.color }}
              {...handlers}
            />
          ));
        })}
      </div>
      {tooltip}
    </>
  );
});

// ── Mapa de áreas ────────────────────────────────────────────────────────────

export interface TreemapItem {
  key: string;
  /** Nome completo (tooltip). */
  label: string;
  /** Nome no retângulo, quando couber. */
  short: string;
  value: number;
  /** % executado, quando a cor fala dele. */
  rate?: number;
  color: string;
  ink: string;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

/** Área = dotação. A cor vem de quem chama: categórica ou a rampa de execução. */
export const TreemapChart = memo(function TreemapChart({
  items,
  width = 640,
  height = 300,
  label,
}: {
  items: TreemapItem[];
  width?: number;
  height?: number;
  label: string;
}) {
  const { bind, tooltip } = useChartTooltip();
  const rects = squarify(items, width, height);
  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className="block h-auto w-full max-w-[720px] overflow-visible"
      >
        {rects.map(({ item, x, y, w, h }) => {
          const big = w > 120 && h > 46;
          const mid = !big && w > 70 && h > 30;
          const rows: TooltipRow[] = [{ label: 'Dotação atualizada', value: formatMoney(item.value) }];
          if (item.rate != null) rows.push({ label: 'Executado (liquidado)', value: formatPercent(item.rate) });
          return (
            <g key={item.key} {...bind({ title: item.label, rows })}>
              <rect x={x + 1} y={y + 1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} fill={item.color} />
              {big ? (
                <>
                  <text x={x + 10} y={y + 22} fontSize={13} fontWeight={600} fill={item.ink}>
                    {clip(item.short, Math.max(6, Math.floor(w / 7.4)))}
                  </text>
                  <text x={x + 10} y={y + 40} fontSize={12.5} fill={item.ink} opacity={0.85}>
                    {compactMoney(item.value)}
                    {item.rate != null ? ` · ${formatPercent(item.rate)}` : ''}
                  </text>
                </>
              ) : mid ? (
                <text x={x + 8} y={y + 19} fontSize={12} fontWeight={600} fill={item.ink}>
                  {clip(item.short, Math.floor(w / 7.6))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {tooltip}
    </>
  );
});

/** Legenda da rampa de "% executado". */
export function SequentialLegend() {
  const first = SEQUENTIAL_EXECUTION[0]!;
  const last = SEQUENTIAL_EXECUTION[SEQUENTIAL_EXECUTION.length - 1]!;
  return (
    <div className="mt-3.5 flex items-center text-xs text-[#4a504b]">
      <em className="mr-2.5 not-italic">% executado</em>
      {SEQUENTIAL_EXECUTION.map((step) => (
        <span key={step.color} className="h-2.5 w-11" style={{ backgroundColor: step.color }} title={step.label} />
      ))}
      <em className="ml-2.5 not-italic">
        {first.label} → {last.label}
      </em>
    </div>
  );
}

// ── Ranking ──────────────────────────────────────────────────────────────────

export interface RankItem {
  key: string;
  label: string;
  value: number;
  rate?: number;
}

/** Pirulito: nome em cima, haste fina e ponto no valor. */
export const LollipopList = memo(function LollipopList({
  rows,
  color = STAGE_COLORS.budget,
}: {
  rows: RankItem[];
  color?: string;
}) {
  const { bind, tooltip } = useChartTooltip();
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <>
      <div className="grid gap-4">
        {rows.map((row) => {
          const width = max > 0 ? Math.max(2, (row.value / max) * 100) : 2;
          const tipRows: TooltipRow[] = [{ label: 'Dotação atualizada', value: formatMoney(row.value) }];
          if (row.rate != null) tipRows.push({ label: 'Executado', value: formatPercent(row.rate) });
          return (
            <div
              key={row.key}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 text-sm"
              {...bind({ title: row.label, rows: tipRows })}
            >
              <span className="col-span-2 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="relative h-3.5" aria-hidden>
                <span className="absolute left-0 top-1.5 h-0.5 bg-[#c3c6bf]" style={{ width: `${width}%` }} />
                <span
                  className="absolute top-0 size-3.5 rounded-full"
                  style={{ left: `calc(${width}% - 7px)`, backgroundColor: color }}
                />
              </span>
              <span className="whitespace-nowrap text-[#4a504b] tabular-nums">{compactMoney(row.value)}</span>
            </div>
          );
        })}
      </div>
      {tooltip}
    </>
  );
});

// ── Alterações da dotação ────────────────────────────────────────────────────

/**
 * Halteres: dotação inicial (círculo vazado) → atualizada (cheio, azul se cresceu,
 * vermelho se caiu), com o saldo à direita.
 *
 * Recebe todos os órgãos: as linhas rolam dentro de um teto de altura e o eixo fica
 * num SVG à parte, fixo embaixo. Os dois reservam o mesmo espaço da barra de rolagem
 * (`scrollbar-gutter: stable`) para terem a mesma largura e a escala casar.
 */
export const DumbbellChart = memo(function DumbbellChart({
  rows,
  width: fallbackWidth = 640,
}: {
  rows: BudgetChangeRow[];
  width?: number;
}) {
  const { bind, tooltip } = useChartTooltip();
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(scrollRef, fallbackWidth);
  const rowHeight = 36;
  const height = rows.length * rowHeight + 4;
  const axisHeight = 30;
  const left = 110;
  const right = 120;
  const max = Math.max(0, ...rows.map((row) => Math.max(row.initialBudget, row.updatedBudget)));
  const x = (value: number) => left + (max > 0 ? (value / max) * (width - left - right) : 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  // A última linha visível é cortada pelo teto: esmaece o pé enquanto há mais abaixo.
  const [atEnd, setAtEnd] = useState(false);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-[#4a504b]">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-3 rounded-full border-2 bg-white" style={{ borderColor: INK_2 }} />
          Dotação inicial (lei)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: CHANGE_COLORS.increase }} />
          Atualizada, cresceu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: CHANGE_COLORS.reduction }} />
          Atualizada, caiu
        </span>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          'max-h-[296px] overflow-y-auto pr-2 [scrollbar-color:#c3c6bf_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]',
          !atEnd && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-40px),transparent)]',
        )}
        onScroll={(event) => {
          const el = event.currentTarget;
          setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Dotação inicial e atualizada por órgão"
          className="block h-auto w-full"
        >
          {ticks.map((fraction) => (
            <line key={fraction} x1={x(max * fraction)} x2={x(max * fraction)} y1={0} y2={height} stroke={GRID} />
          ))}
          {rows.map((row, index) => {
            const y = 20 + index * rowHeight;
            const net = row.updatedBudget - row.initialBudget;
            const grew = net >= 0;
            const color = grew ? CHANGE_COLORS.increase : CHANGE_COLORS.reduction;
            const textColor = grew ? CHANGE_TEXT_COLORS.increase : CHANGE_TEXT_COLORS.reduction;
            return (
              <g
                key={row.key}
                {...bind({
                  title: row.label,
                  big: { label: 'saldo desde a lei', value: signedMoney(net), color: textColor },
                  rows: [
                    { label: 'Dotação inicial (lei)', value: formatMoney(row.initialBudget), color: INK_2, marker: 'ring' },
                    { label: 'Dotação atualizada', value: formatMoney(row.updatedBudget), color, marker: 'dot' },
                    'divider',
                    { label: 'Acréscimos', value: signedMoney(row.increases), color: CHANGE_COLORS.increase },
                    { label: 'Reduções', value: signedMoney(row.reductions), color: CHANGE_COLORS.reduction },
                  ],
                  note: 'Acréscimos e reduções somados por linha do QDD, que já vem líquida: um remanejamento dentro da mesma linha não aparece.',
                })}
              >
                {/* Faixa invisível: a linha inteira responde ao mouse, não só os pontos. */}
                <rect x={0} y={y - rowHeight / 2} width={width} height={rowHeight} fill="transparent" />
                <text x={0} y={y + 5} fontSize={14} fill={INK}>
                  {clip(row.chartLabel ?? row.shortLabel, 13)}
                </text>
                <line x1={x(row.initialBudget)} x2={x(row.updatedBudget)} y1={y} y2={y} stroke={color} strokeWidth={3} />
                <circle cx={x(row.initialBudget)} cy={y} r={6} fill="#fff" stroke={INK_2} strokeWidth={2} />
                <circle cx={x(row.updatedBudget)} cy={y} r={7} fill={color} />
                <text x={width} y={y + 5} textAnchor="end" fontSize={14} fontWeight={600} fill={textColor}>
                  {signedCompactMoney(net)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="overflow-y-hidden pr-2 [scrollbar-gutter:stable] [scrollbar-width:thin]">
        <svg viewBox={`0 0 ${width} ${axisHeight}`} aria-hidden className="block h-auto w-full">
          {ticks.map((fraction) => (
            <g key={fraction}>
              <line x1={x(max * fraction)} x2={x(max * fraction)} y1={0} y2={8} stroke={GRID} />
              <text x={x(max * fraction)} y={axisHeight - 8} textAnchor="middle" fontSize={12} fill={INK_3}>
                {compactAxis(max * fraction)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {tooltip}
    </>
  );
});

// ── Dispersão ────────────────────────────────────────────────────────────────

/** X = dotação atualizada, Y = % executado (até 100), área da bolha = pago. */
export const BubbleScatter = memo(function BubbleScatter({ rows }: { rows: ExecutionRow[] }) {
  const { bind, tooltip } = useChartTooltip();
  const points = rows.filter((row) => row.updatedBudget > 0).sort((a, b) => b.paid - a.paid);
  const width = 640;
  const height = 320;
  const pad = { left: 42, right: 40, top: 26, bottom: 30 };
  const maxBudget = Math.max(0, ...points.map((row) => row.updatedBudget));
  const maxPaid = Math.max(0, ...points.map((row) => row.paid));
  const x = (value: number) => pad.left + (maxBudget > 0 ? (value / maxBudget) * (width - pad.left - pad.right) : 0);
  const y = (rate: number) =>
    height - pad.bottom - (Math.max(0, Math.min(rate, 100)) / 100) * (height - pad.top - pad.bottom);
  const radius = (row: ExecutionRow) => 4 + (maxPaid > 0 ? Math.sqrt(Math.max(0, row.paid) / maxPaid) * 18 : 0);
  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Dotação atualizada e percentual executado por órgão"
        className="block h-auto w-full max-w-[720px] overflow-visible"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={tick ? '#e6e8e2' : INK} />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" fontSize={12} fill={INK_3}>
              {tick}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <text key={fraction} x={x(maxBudget * fraction)} y={height - 8} textAnchor="middle" fontSize={12} fill={INK_3}>
            {compactAxis(maxBudget * fraction)}
          </text>
        ))}
        {points.map((row) => (
          <circle
            key={row.key}
            cx={x(row.updatedBudget)}
            cy={y(row.executionRate)}
            r={radius(row)}
            fill={STAGE_COLORS.liquidated}
            fillOpacity={0.45}
            stroke={STAGE_COLORS.liquidated}
            {...bind({
              title: row.label,
              big: {
                label: 'executado (liquidado ÷ dotação)',
                value: formatPercent(row.executionRate),
                color: STAGE_COLORS.liquidated,
              },
              rows: [
                { label: 'Dotação atualizada', value: formatMoney(row.updatedBudget) },
                { label: 'Liquidado', value: formatMoney(row.liquidated), color: STAGE_COLORS.liquidated },
                { label: 'Pago', value: formatMoney(row.paid), color: STAGE_COLORS.paid },
              ],
            })}
          />
        ))}
        {points.slice(0, 5).map((row) => (
          <text
            key={`label-${row.key}`}
            x={x(row.updatedBudget)}
            y={y(row.executionRate) - radius(row) - 6}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={INK}
            className="pointer-events-none"
          >
            {row.chartLabel ?? row.shortLabel}
          </text>
        ))}
      </svg>
      {tooltip}
    </>
  );
});

// ── Lista de alerta ──────────────────────────────────────────────────────────

/** Linhas nome × valor com filetes, para listas curtas de atenção. */
export function WatchList({ rows }: { rows: Array<{ key: string; label: string; title?: string; value: string }> }) {
  return (
    <div className="grid border-t border-[#e1e3dd]">
      {rows.map((row) => (
        <div
          key={row.key}
          className="fiscal-low-execution-row grid grid-cols-[minmax(0,1fr)_7rem] gap-4 border-b border-[#e1e3dd] py-3 text-sm"
        >
          <span className="truncate" title={row.title ?? row.label}>
            {row.label}
          </span>
          <span className="text-right text-[#4a504b] tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Ajudantes de dados para os blocos ────────────────────────────────────────

/** Nome legível de um rótulo agregado ("20010000 — MANUTENÇÃO…" → "Manutenção…"). */
export function readableLabel(label: string): string {
  return readableName(withoutCode(label));
}

/** Itens coloridos na ordem da paleta, com "Demais" no cinza. */
export function paintItems(
  items: Array<{ key: string; label: string; value: number }>,
  palette: readonly string[],
): ColoredItem[] {
  return items.map((item, index) => ({
    ...item,
    color: item.key === '__other__' ? CHART_OTHER : (palette[index] ?? CHART_OTHER),
  }));
}
