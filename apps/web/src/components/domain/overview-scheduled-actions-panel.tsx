'use client';

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CalculatorIcon, ChevronDownIcon, ChevronRightIcon, DatabaseIcon, DownloadIcon, SearchIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ThemeBadge } from '@/components/domain/badges';
import { ExpenseBreakdownTable } from '@/components/domain/expense-breakdown-table';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import { SearchableCombobox, type SearchableComboboxItem } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, themeLabels } from '@/lib/api';
import { effectiveWeightingFactor } from '@/lib/classification-rules';
import { actionIsAmendment, actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { buildExpenseRows } from '@/lib/expense-breakdown';
import {
  EXECUTION_METRIC_LABELS,
  EXECUTION_METRICS,
  type ExecutionMetric,
} from '@/lib/execution-monitor';
import { organizationAcronym } from '@/lib/organization-acronym';
import { cn } from '@/lib/utils';
import type { BudgetAction, BudgetImport, ThemeBudget } from '@/types/domain';
import { DataReferenceBadge } from '@/components/domain/data-reference-badge';

const ALL = 'ALL';
const NO_WEIGHTING = 'NONE';
const ROW_GAP = 2;
const ROW_ESTIMATE = 74;
const EXECUTION_TABLE_MIN_WIDTH = 'min-w-[72rem]';
const SELECTABLE_TABLE_MIN_WIDTH = 'min-w-[50rem]';
const DEFAULT_TABLE_MIN_WIDTH = 'min-w-[48rem]';

const switchTrackClass =
  'group relative inline-block h-[2em] w-[3.5em] shrink-0 cursor-pointer rounded-[10px] bg-[rgb(182,182,182)] text-[15px] outline-none transition-colors duration-[400ms] focus-visible:shadow-[0_0_1px_#2196F3] data-[state=checked]:bg-[#166534] md:text-[17px]';
const switchThumbClass =
  'absolute bottom-[0.3em] left-[0.3em] size-[1.4em] rounded-[8px] bg-white transition-transform duration-[400ms] group-data-[state=checked]:translate-x-[1.5em]';

type OrganizationOption = { code: string; name: string };

type Props = {
  actions: BudgetAction[];
  organizations?: OrganizationOption[];
  /** Chaves "organizationCode|unitCode" de unidades marcadas como realocadas. */
  relocatedUnitKeys?: Set<string>;
  /** Importação vigente, usada para exibir exercício e data de atualização dos dados. */
  vigenteImport?: BudgetImport | null;
  lockedScopeLabel?: string;
  /** Adapta o painel para receber órgão, função, subfunção e busca de filtros externos. */
  variant?: 'thematic' | 'execution';
  /** Estágio selecionado no monitor de execução, destacado como na aba Tabela. */
  executionMetric?: ExecutionMetric;
};

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

type OverviewActionRowProps = {
  action: BudgetAction;
  showUnit: boolean;
  selectable: boolean;
  selectionState: 'none' | 'partial' | 'full';
  selectedLineKeys: ReadonlySet<string>;
  relocated: boolean;
  institutional: boolean;
  executionMetric?: ExecutionMetric;
  expanded: boolean;
  onToggle: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleLine: (actionId: string, lineKey: string) => void;
};

const EMPTY_LINE_KEYS: ReadonlySet<string> = new Set();

const OverviewActionRow = memo(function OverviewActionRow({
  action,
  showUnit,
  selectable,
  selectionState,
  selectedLineKeys,
  relocated,
  institutional,
  executionMetric,
  expanded,
  onToggle,
  onToggleExpand,
  onToggleLine,
}: OverviewActionRowProps) {
  const selected = selectionState !== 'none';
  const checkboxChecked =
    selectionState === 'full' ? true : selectionState === 'partial' ? 'indeterminate' : false;
  const minWidth = institutional
    ? EXECUTION_TABLE_MIN_WIDTH
    : selectable
      ? SELECTABLE_TABLE_MIN_WIDTH
      : DEFAULT_TABLE_MIN_WIDTH;
  return (
    <div className={`w-full ${minWidth}`}>
      <Table className="table-fixed w-full">
        <TableBody>
          <TableRow
            data-state={selectable && selected ? 'selected' : undefined}
            onClick={selectable ? () => onToggle(action.id) : undefined}
            className={`data-[state=selected]:bg-muted/40 ${institutional ? 'border-b border-black/15 hover:bg-stone-50' : ''} ${selectable ? 'cursor-pointer' : ''}`}
          >
            {selectable ? (
              <TableCell
                className="w-5 px-0 py-2 text-center align-middle"
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  className="mx-auto size-5"
                  checked={checkboxChecked}
                  onCheckedChange={() => onToggle(action.id)}
                  aria-label={`Selecionar ${action.application}`}
                />
              </TableCell>
            ) : null}
            <TableCell className="w-[36%] min-w-[12rem] whitespace-normal break-words py-2 align-top">
              <div className="flex min-w-0 items-start gap-1.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Ocultar despesas' : 'Mostrar despesas'}
                  title={expanded ? 'Ocultar despesas' : 'Mostrar despesas'}
                  className={cn(
                    'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    institutional ? 'rounded-none' : 'rounded-md',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(action.id);
                  }}
                >
                  {expanded ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                </button>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p
                    className="cursor-pointer text-sm font-medium leading-snug hover:underline"
                    title={expanded ? 'Ocultar despesas' : 'Mostrar despesas'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand(action.id);
                    }}
                  >
                    {action.application}
                    {relocated ? (
                      <span
                        className="text-blue-600 dark:text-blue-400"
                        title="Unidade realocada para uma nova secretaria"
                      >
                        {' - REALOCADA'}
                      </span>
                    ) : null}
                  </p>
                  <FunctionalProgramLine
                    functionalProgram={action.functionalProgram}
                    projectActivity={action.projectActivity}
                  >
                    {action.assignments.map((item) => (
                      <ThemeBadge key={item.id} theme={item.theme} />
                    ))}
                  </FunctionalProgramLine>
                </div>
              </div>
            </TableCell>
          <TableCell className="w-[6rem] py-2 align-top text-sm">
            <span
              className="font-medium"
              title={`${action.organizationCode} — ${action.organizationName}`}
            >
              {organizationAcronym(action.organizationCode, action.organizationName)}
            </span>
          </TableCell>
          {showUnit ? (
            <TableCell className="w-[15%] max-w-[9rem] py-2 align-top text-sm">
              <span className="text-xs text-muted-foreground">{action.unitCode}</span>
              <p className="truncate text-xs" title={action.unitName}>
                {action.unitName}
              </p>
            </TableCell>
          ) : null}
          {institutional ? (
            EXECUTION_METRICS.map((metric) => (
              <TableCell
                key={metric}
                className={cn(
                  'w-[8rem] whitespace-nowrap py-2 text-right align-top tabular-nums text-sm',
                  metric === executionMetric && 'font-semibold',
                )}
              >
                {formatMoney(action.totals[metric])}
              </TableCell>
            ))
          ) : (
            <>
              <TableCell className="w-[7.5rem] whitespace-nowrap py-2 text-right align-top tabular-nums text-sm">
                {formatMoney(action.totals.initialBudget)}
              </TableCell>
              <TableCell className="w-[7.5rem] whitespace-nowrap py-2 text-right align-top tabular-nums text-sm">
                {formatMoney(action.totals.updatedBudget)}
              </TableCell>
              <TableCell className="w-[7.5rem] whitespace-nowrap py-2 text-right align-top tabular-nums text-sm">
                {formatMoney(action.totals.liquidated)}
              </TableCell>
              <TableCell className="w-[7.5rem] whitespace-nowrap py-2 text-right align-top tabular-nums text-sm">
                {formatMoney(action.totals.updatedBudget - action.totals.liquidated)}
              </TableCell>
            </>
          )}
          </TableRow>
        </TableBody>
      </Table>
      {expanded ? (
        <div className="px-2 pb-3 pt-1" onClick={(event) => event.stopPropagation()}>
          <ExpenseBreakdownTable
            action={action}
            selectable={selectable}
            allSelected={selectionState === 'full'}
            selectedLineKeys={selectedLineKeys}
            onToggleLine={(lineKey) => onToggleLine(action.id, lineKey)}
            onToggleAll={() => onToggle(action.id)}
          />
        </div>
      ) : null}
    </div>
  );
});

export const OverviewScheduledActionsPanel = memo(function OverviewScheduledActionsPanel({
  actions,
  organizations = [],
  relocatedUnitKeys,
  vigenteImport,
  lockedScopeLabel,
  variant = 'thematic',
  executionMetric,
}: Props) {
  const [organizationCode, setOrganizationCode] = useState(ALL);
  const [unitCode, setUnitCode] = useState(ALL);
  const [functionFilter, setFunctionFilter] = useState(ALL);
  const [subfunctionFilter, setSubfunctionFilter] = useState(ALL);
  const [theme, setTheme] = useState(ALL);
  const [onlyEmendas, setOnlyEmendas] = useState(false);
  const [weightedTheme, setWeightedTheme] = useState<ThemeBudget | typeof NO_WEIGHTING>(
    NO_WEIGHTING,
  );
  const weighted = weightedTheme !== NO_WEIGHTING;
  const hasLockedScope = Boolean(lockedScopeLabel);
  const isExecutionVariant = variant === 'execution';
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedLines, setSelectedLines] = useState<Map<string, Set<string>>>(() => new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [calculatorMode, setCalculatorMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [exportThemes, setExportThemes] = useState<Set<ThemeBudget>>(
    () => new Set(Object.keys(themeLabels) as ThemeBudget[]),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevExpandedIdsRef = useRef<Set<string>>(expandedIds);

  const actionsById = useMemo(() => {
    const map = new Map<string, BudgetAction>();
    for (const action of actions) map.set(action.id, action);
    return map;
  }, [actions]);

  // Seleção da ação inteira (checkbox/clique da linha): se a ação tem qualquer
  // seleção (cheia ou parcial), limpa; senão marca como cheia.
  const toggleSelection = useCallback(
    (id: string) => {
      const hasAny = selectedIds.has(id) || selectedLines.has(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (hasAny) next.delete(id);
        else next.add(id);
        return next;
      });
      setSelectedLines((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [selectedIds, selectedLines],
  );

  // Seleção de uma linha de despesa (conta + fonte) dentro de uma ação.
  const toggleLine = useCallback(
    (actionId: string, lineKey: string) => {
      const allKeys = buildExpenseRows(actionsById.get(actionId) ?? null).map((row) => row.key);
      const isFull = selectedIds.has(actionId);

      const current = new Set(isFull ? allKeys : selectedLines.get(actionId) ?? []);
      if (current.has(lineKey)) current.delete(lineKey);
      else current.add(lineKey);

      const promoteToFull = allKeys.length > 0 && current.size === allKeys.length;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (promoteToFull) next.add(actionId);
        else next.delete(actionId);
        return next;
      });
      setSelectedLines((prev) => {
        const next = new Map(prev);
        if (promoteToFull || current.size === 0) next.delete(actionId);
        else next.set(actionId, current);
        return next;
      });
    },
    [actionsById, selectedIds, selectedLines],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedLines(new Map());
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCalculator = useCallback(() => {
    setCalculatorMode((enabled) => {
      if (enabled) {
        setSelectedIds(new Set());
        setSelectedLines(new Map());
      }
      return !enabled;
    });
  }, []);

  const units = useMemo(() => {
    return uniqueBy(
      actions.filter(
        (action) => organizationCode === ALL || action.organizationCode === organizationCode,
      ),
      (action) => `${action.organizationCode}-${action.unitCode}`,
    )
      .map((action) => ({
        code: action.unitCode,
        name: action.unitName,
        organizationCode: action.organizationCode,
      }))
      .sort((a, b) => `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`));
  }, [actions, organizationCode]);

  const unitComboboxItems = useMemo<SearchableComboboxItem[]>(() => {
    const byValue = new Map<string, SearchableComboboxItem>([[ALL, { value: ALL, label: 'Todas as unidades' }]]);
    for (const unit of units) {
      if (!byValue.has(unit.code)) {
        byValue.set(unit.code, { value: unit.code, label: `${unit.code} - ${unit.name}` });
      }
    }
    return [...byValue.values()];
  }, [units]);

  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      if (organizationCode !== ALL && action.organizationCode !== organizationCode) return false;
      if (unitCode !== ALL && action.unitCode !== unitCode) return false;
      if (theme !== ALL && !action.assignments.some((item) => item.theme === theme)) return false;
      if (onlyEmendas && !actionIsAmendment(action)) return false;
      if (!actionMatchesFunctionalFilters(action, functionFilter, subfunctionFilter, ALL)) {
        return false;
      }
      return true;
    });
  }, [actions, organizationCode, unitCode, theme, onlyEmendas, functionFilter, subfunctionFilter]);

  const displayedActions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredActions;
    return filteredActions.filter(
      (action) =>
        action.application.toLowerCase().includes(q) ||
        action.functionalProgram.toLowerCase().includes(q) ||
        action.projectActivity.toLowerCase().includes(q),
    );
  }, [filteredActions, search]);

  const totals = useMemo(
    () =>
      displayedActions.reduce(
        (acc, action) => ({
          initialBudget: acc.initialBudget + action.totals.initialBudget,
          updatedBudget: acc.updatedBudget + action.totals.updatedBudget,
          liquidated: acc.liquidated + action.totals.liquidated,
        }),
        { initialBudget: 0, updatedBudget: 0, liquidated: 0 },
      ),
    [displayedActions],
  );

  // Totais ponderados pelo tema selecionado: soma, por ação exibida, a contribuição da
  // atribuição daquele tema (orçamento × ponderador). Categorias por entrega = 0.
  const weightedTotals = useMemo(() => {
    let initialBudget = 0;
    let updatedBudget = 0;
    let liquidated = 0;
    let available = 0;
    for (const action of displayedActions) {
      for (const a of action.assignments) {
        if (a.theme !== weightedTheme) continue;
        const factor = effectiveWeightingFactor(a.theme, a.classification, a.weightingFactor);
        initialBudget += action.totals.initialBudget * factor;
        updatedBudget += action.totals.updatedBudget * factor;
        liquidated += action.totals.liquidated * factor;
        available += (action.totals.updatedBudget - action.totals.liquidated) * factor;
      }
    }
    return { initialBudget, updatedBudget, liquidated, available };
  }, [displayedActions, weightedTheme]);

  const selectedCount = selectedIds.size + selectedLines.size;

  const selectedTotals = useMemo(() => {
    let initialBudget = 0;
    let updatedBudget = 0;
    let liquidated = 0;
    // Ações cheias: usa os totais da ação.
    for (const id of selectedIds) {
      const action = actionsById.get(id);
      if (!action) continue;
      initialBudget += action.totals.initialBudget;
      updatedBudget += action.totals.updatedBudget;
      liquidated += action.totals.liquidated;
    }
    // Ações parciais: soma apenas as linhas (conta + fonte) marcadas.
    for (const [id, keys] of selectedLines) {
      const action = actionsById.get(id);
      if (!action) continue;
      for (const row of buildExpenseRows(action)) {
        if (!keys.has(row.key)) continue;
        initialBudget += row.initialBudget;
        updatedBudget += row.updatedBudget;
        liquidated += row.liquidated;
      }
    }
    return { initialBudget, updatedBudget, liquidated };
  }, [selectedIds, selectedLines, actionsById]);

  const displayedSelectionState = useMemo<'none' | 'some' | 'all'>(() => {
    if (displayedActions.length === 0) return 'none';
    let fullInView = 0;
    let anyInView = 0;
    for (const action of displayedActions) {
      if (selectedIds.has(action.id)) {
        fullInView += 1;
        anyInView += 1;
      } else if (selectedLines.has(action.id)) {
        anyInView += 1;
      }
    }
    if (anyInView === 0) return 'none';
    return fullInView === displayedActions.length ? 'all' : 'some';
  }, [displayedActions, selectedIds, selectedLines]);

  const toggleSelectDisplayed = useCallback(() => {
    const allFull = displayedActions.length > 0 && displayedActions.every((action) => selectedIds.has(action.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const action of displayedActions) {
        if (allFull) next.delete(action.id);
        else next.add(action.id);
      }
      return next;
    });
    // Limpa qualquer seleção parcial das ações exibidas (viram cheias ou nenhuma).
    setSelectedLines((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const action of displayedActions) next.delete(action.id);
      return next;
    });
  }, [displayedActions, selectedIds]);

  const showUnit = unitCode === ALL;
  const tableMinWidth = isExecutionVariant
    ? EXECUTION_TABLE_MIN_WIDTH
    : calculatorMode
      ? SELECTABLE_TABLE_MIN_WIDTH
      : DEFAULT_TABLE_MIN_WIDTH;
  const tableHeadClass = isExecutionVariant
    ? 'bg-green-900 text-white'
    : 'bg-background text-muted-foreground';

  const selectedOrganization = useMemo(() => {
    if (organizationCode === ALL) return null;
    return organizations.find((org) => org.code === organizationCode) ?? null;
  }, [organizationCode, organizations]);

  const selectedUnitLabel = useMemo(() => {
    if (unitCode === ALL) return null;
    const unit =
      organizationCode === ALL
        ? units.find((item) => item.code === unitCode)
        : units.find(
            (item) => item.code === unitCode && item.organizationCode === organizationCode,
          );
    return unit ? `${unit.code} — ${unit.name}` : unitCode;
  }, [units, unitCode, organizationCode]);

  const scopeDescription = useMemo(() => {
    const count = displayedActions.length.toLocaleString('pt-BR');
    if (isExecutionVariant) {
      const unitPart = selectedUnitLabel ? ` · ${selectedUnitLabel}` : '';
      return `${count} ação(ões) nos filtros do dashboard${unitPart}`;
    }
    if (hasLockedScope) {
      const unitPart = showUnit ? ' · todas as unidades' : ` · ${selectedUnitLabel ?? '—'}`;
      return `${count} ação(ões) · ${lockedScopeLabel}${unitPart}`;
    }
    if (organizationCode === ALL) {
      const unitPart = selectedUnitLabel ? ` · ${selectedUnitLabel}` : '';
      return `${count} ação(ões) · todas as secretarias${unitPart}`;
    }
    const unitPart = showUnit ? ' · todas as unidades' : ` · ${selectedUnitLabel ?? '—'}`;
    return `${count} ação(ões) · ${selectedOrganization?.code ?? organizationCode} — ${selectedOrganization?.name ?? ''}${unitPart}`;
  }, [
    displayedActions.length,
    hasLockedScope,
    isExecutionVariant,
    lockedScopeLabel,
    organizationCode,
    selectedOrganization,
    selectedUnitLabel,
    showUnit,
  ]);

  const virtualizer = useVirtualizer({
    count: displayedActions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE + ROW_GAP,
    overscan: 12,
    // offsetHeight (e não getBoundingClientRect) porque o Card usa `zoom`: o
    // getBoundingClientRect retornaria a altura já escalada pelo zoom, enquanto
    // o posicionamento (translateY) trabalha no espaço de layout não escalado —
    // isso causaria sobreposição entre linhas (pior ao expandir o detalhamento).
    measureElement: (element) => (element as HTMLElement).offsetHeight + ROW_GAP,
  });

  // Ao expandir/recolher uma ação, a altura da linha muda e o virtualizer precisa
  // reposicionar as linhas seguintes. Sob `zoom` o ResizeObserver interno é
  // intermitente, então re-medimos explicitamente as linhas afetadas no próximo frame
  // (mesmo padrão do painel de Curadoria) para evitar sobreposição.
  useLayoutEffect(() => {
    const prev = prevExpandedIdsRef.current;
    const changedIds = new Set<string>();
    for (const id of expandedIds) if (!prev.has(id)) changedIds.add(id);
    for (const id of prev) if (!expandedIds.has(id)) changedIds.add(id);
    prevExpandedIdsRef.current = expandedIds;
    if (changedIds.size === 0) return;

    const frame = requestAnimationFrame(() => {
      for (const id of changedIds) {
        const index = displayedActions.findIndex((a) => a.id === id);
        if (index < 0) continue;
        const node = scrollRef.current?.querySelector<HTMLElement>(
          `[data-index="${index}"]`,
        );
        if (node) virtualizer.measureElement(node);
      }
    });
    return () => cancelAnimationFrame(frame);
    // virtualizer.measureElement é estável; omitido das deps de propósito
  }, [expandedIds, displayedActions]);

  const handleOrganizationChange = useCallback((value: string) => {
    setOrganizationCode(value);
    setUnitCode(ALL);
    setSearch('');
  }, []);

  const hasActiveFilters =
    (!hasLockedScope && organizationCode !== ALL) ||
    unitCode !== ALL ||
    functionFilter !== ALL ||
    subfunctionFilter !== ALL ||
    theme !== ALL ||
    onlyEmendas ||
    search.trim() !== '';

  const clearFilters = useCallback(() => {
    if (!hasLockedScope) setOrganizationCode(ALL);
    setUnitCode(ALL);
    setFunctionFilter(ALL);
    setSubfunctionFilter(ALL);
    setTheme(ALL);
    setOnlyEmendas(false);
    setSearch('');
  }, [hasLockedScope]);

  const orgComboboxItems = useMemo(
    () => [
      { value: ALL, label: 'Todos os órgãos' },
      ...organizations.map((org) => ({
        value: org.code,
        label: `${org.code} - ${org.name}`,
      })),
    ],
    [organizations],
  );

  const toggleExportTheme = useCallback((theme: ThemeBudget) => {
    setExportThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (exportThemes.size === 0 || displayedActions.length === 0) return;
    try {
      const { buildOverviewRows, exportOverview } = await import('@/lib/overview-export');
      const rows = buildOverviewRows(displayedActions, exportThemes);
      if (rows.length === 0) {
        toast.error('Nenhuma ação com tema selecionado para exportar.');
        return;
      }
      exportOverview(rows, exportFormat);
      setExportOpen(false);
      toast.success(`Exportação ${exportFormat.toUpperCase()} concluída (${rows.length} linha(s)).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar.');
    }
  }, [displayedActions, exportThemes, exportFormat]);

  return (
    <Card
      className={
        isExecutionVariant
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-none border-black/70 bg-white py-0 shadow-none'
          : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
      }
      style={{ zoom: isExecutionVariant ? 1 : 0.85 }}
    >
      {!isExecutionVariant ? <CardHeader className="shrink-0">
        <CardTitle>
          {hasLockedScope
            ? `Visão geral — ${lockedScopeLabel}`
            : organizationCode === ALL
              ? 'Ações programadas'
              : selectedOrganization
                ? `${selectedOrganization.code} — ${selectedOrganization.name}`
                : 'Ações programadas'}
        </CardTitle>
        <CardDescription>
          <span className="block">{scopeDescription}</span>
        </CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <DataReferenceBadge vigenteImport={vigenteImport} />
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none">
              Emendas
              <button
                type="button"
                role="switch"
                aria-checked={onlyEmendas}
                data-state={onlyEmendas ? 'checked' : 'unchecked'}
                onClick={() => setOnlyEmendas((value) => !value)}
                className={switchTrackClass}
              >
                <span aria-hidden className={switchThumbClass} />
              </button>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium select-none">
              Ponderar por
              <Select
                value={weightedTheme}
                onValueChange={(value) =>
                  setWeightedTheme(value as ThemeBudget | typeof NO_WEIGHTING)
                }
              >
                <SelectTrigger className="h-8 w-[10rem] min-w-0 md:h-9">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={NO_WEIGHTING}>Nenhum</SelectItem>
                    {Object.entries(themeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <Button
              variant={calculatorMode ? 'default' : 'outline'}
              size="lg"
              className="h-8 md:h-9"
              aria-pressed={calculatorMode}
              onClick={toggleCalculator}
            >
              <CalculatorIcon />
              Somar
            </Button>
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="lg" className="h-8 md:h-9">
                  <DownloadIcon />
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
                <div className="space-y-2">
                  <Label className={filterFieldLabelClass}>Orçamentos temáticos</Label>
                  <div className="space-y-2">
                    {(Object.entries(themeLabels) as [ThemeBudget, string][]).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={exportThemes.has(key)}
                          onCheckedChange={() => toggleExportTheme(key)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleExport}
                  disabled={exportThemes.size === 0 || displayedActions.length === 0}
                >
                  <DownloadIcon />
                  Exportar
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="lg"
              className="h-8 md:h-9"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              <XIcon />
              Limpar filtros
            </Button>
          </div>
        </CardAction>
      </CardHeader> : null}
      <CardContent
        className={
          isExecutionVariant
            ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0'
            : 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden md:gap-4'
        }
      >
        {!isExecutionVariant ? (
          <div className="flex shrink-0 flex-col gap-2 md:gap-3">
          <div className={hasLockedScope ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 md:gap-3' : 'grid grid-cols-2 gap-2 lg:grid-cols-4 md:gap-3'}>
            {!hasLockedScope ? (
              <Field className="min-w-0 gap-1.5">
                <FieldLabel className={filterFieldLabelClass}>Órgão</FieldLabel>
                <SearchableCombobox
                  className="relative w-full min-w-0"
                  value={organizationCode}
                  onChange={handleOrganizationChange}
                  placeholder="Todos os órgãos"
                  items={orgComboboxItems}
                />
              </Field>
            ) : null}
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Unidade</FieldLabel>
              <SearchableCombobox
                className="relative w-full min-w-0"
                value={unitCode}
                onChange={setUnitCode}
                placeholder="Todas as unidades"
                items={unitComboboxItems}
              />
            </Field>
            <FunctionalClassificationFilters
              actions={actions}
              functionFilter={functionFilter}
              subfunctionFilter={subfunctionFilter}
              onFunctionChange={setFunctionFilter}
              onSubfunctionChange={setSubfunctionFilter}
              allValue={ALL}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-2 md:gap-3">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value={ALL}>Todos os temas</SelectItem>
                  {Object.entries(themeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="relative min-w-0">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar ação, programa funcional..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full min-w-0 pl-9"
              />
            </div>
          </div>
          </div>
        ) : null}

        {!isExecutionVariant ? <div className="grid min-w-0 shrink-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5 md:gap-3">
          {[
            { label: 'Ações', value: displayedActions.length.toLocaleString('pt-BR') },
            {
              label: weighted ? 'Planejado inicial ponderado' : 'Planejado inicial',
              value: formatMoney((weighted ? weightedTotals : totals).initialBudget),
            },
            {
              label: weighted ? 'Orçamento atualizado ponderado' : 'Orçamento atualizado',
              value: formatMoney((weighted ? weightedTotals : totals).updatedBudget),
            },
            {
              label: weighted ? 'Liquidado ponderado' : 'Liquidado',
              value: formatMoney((weighted ? weightedTotals : totals).liquidated),
            },
            {
              label: weighted ? 'Disponível ponderado' : 'Disponível',
              value: formatMoney(
                weighted ? weightedTotals.available : totals.updatedBudget - totals.liquidated,
              ),
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 border-0 bg-transparent p-0 md:rounded-lg md:border md:bg-white md:p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs">{stat.label}</p>
              <p className="truncate text-sm font-semibold tabular-nums md:mt-0.5 md:text-lg">{stat.value}</p>
            </div>
          ))}
        </div> : null}

        {displayedActions.length === 0 ? (
          isExecutionVariant ? (
            <div className="flex h-full min-h-40 items-center justify-center p-6 text-center">
              <div>
                <p className="text-sm font-semibold">Nenhuma ação encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Não há ações orçamentárias para os filtros aplicados.
                </p>
              </div>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia>
                  <DatabaseIcon />
                </EmptyMedia>
              </EmptyHeader>
              <EmptyTitle>Nenhuma ação encontrada</EmptyTitle>
              <EmptyDescription>Não há ações programadas para a seleção atual.</EmptyDescription>
            </Empty>
          )
        ) : (
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!isExecutionVariant ? <Separator className="shrink-0" /> : null}
            <div ref={scrollRef} className="h-0 min-h-0 min-w-0 flex-1 overflow-auto">
              <div className={`sticky top-0 z-10 w-full ${tableMinWidth}`}>
                <Table className="table-fixed w-full">
                  <TableHeader
                    className={cn(isExecutionVariant ? 'bg-green-900' : 'bg-background')}
                  >
                    <TableRow
                      style={
                        isExecutionVariant
                          ? { borderBottomColor: '#000', borderBottomWidth: '1px' }
                          : undefined
                      }
                    >
                      {calculatorMode ? (
                        <TableHead className="h-9 w-5 px-0 bg-background text-center align-middle">
                          <Checkbox
                            className="mx-auto size-5"
                            checked={
                              displayedSelectionState === 'all'
                                ? true
                                : displayedSelectionState === 'some'
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={toggleSelectDisplayed}
                            aria-label="Selecionar todas as ações exibidas"
                          />
                        </TableHead>
                      ) : null}
                      <TableHead className={cn('h-9 w-[36%] min-w-[12rem] text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                        Ação
                      </TableHead>
                      <TableHead className={cn('h-9 w-[6rem] text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                        Órgão
                      </TableHead>
                      {showUnit ? (
                        <TableHead className={cn('h-9 w-[15%] max-w-[9rem] text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                          Unidade
                        </TableHead>
                      ) : null}
                      {isExecutionVariant ? (
                        EXECUTION_METRICS.map((metric) => (
                          <TableHead
                            key={metric}
                            className={cn(
                              'h-9 w-[8rem] text-right text-xs uppercase tracking-[0.12em]',
                              tableHeadClass,
                              metric === executionMetric && 'font-semibold',
                            )}
                          >
                            {EXECUTION_METRIC_LABELS[metric]}
                          </TableHead>
                        ))
                      ) : (
                        <>
                          <TableHead className={cn('h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                            Inicial
                          </TableHead>
                          <TableHead className={cn('h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                            Atualizado
                          </TableHead>
                          <TableHead className={cn('h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                            Liquidado
                          </TableHead>
                          <TableHead className={cn('h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em]', tableHeadClass)}>
                            Disponível
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
              <div
                className={`relative w-full ${tableMinWidth}`}
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const action = displayedActions[virtualRow.index];
                  if (!action) return null;
                  return (
                    <div
                      key={action.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <OverviewActionRow
                        action={action}
                        showUnit={showUnit}
                        selectable={calculatorMode}
                        selectionState={
                          selectedIds.has(action.id)
                            ? 'full'
                            : selectedLines.has(action.id)
                              ? 'partial'
                              : 'none'
                        }
                        selectedLineKeys={selectedLines.get(action.id) ?? EMPTY_LINE_KEYS}
                        relocated={relocatedUnitKeys?.has(`${action.organizationCode}|${action.unitCode}`) ?? false}
                        institutional={isExecutionVariant}
                        executionMetric={executionMetric}
                        expanded={expandedIds.has(action.id)}
                        onToggle={toggleSelection}
                        onToggleExpand={toggleExpand}
                        onToggleLine={toggleLine}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {calculatorMode && selectedCount > 0 ? (
          <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-primary/30 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary tabular-nums">
                {selectedCount.toLocaleString('pt-BR')} selecionada(s)
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <XIcon />
                Limpar seleção
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-x-7 gap-y-1">
              {[
                { label: 'Inicial', value: selectedTotals.initialBudget },
                { label: 'Atualizado', value: selectedTotals.updatedBudget },
                { label: 'Liquidado', value: selectedTotals.liquidated },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="truncate text-lg font-semibold tabular-nums">{formatMoney(stat.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
