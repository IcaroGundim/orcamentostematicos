'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CalculatorIcon, ChevronDownIcon, ChevronRightIcon, DatabaseIcon, SearchIcon, XIcon } from 'lucide-react';

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
import { actionIsAmendment, actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { buildExpenseRows } from '@/lib/expense-breakdown';
import { organizationAcronym } from '@/lib/organization-acronym';
import type { BudgetAction } from '@/types/domain';

const ALL = 'ALL';
const ROW_GAP = 2;
const ROW_ESTIMATE = 74;

const switchTrackClass =
  'group relative inline-block h-[2em] w-[3.5em] shrink-0 cursor-pointer rounded-[10px] bg-[rgb(182,182,182)] text-[15px] outline-none transition-colors duration-[400ms] focus-visible:shadow-[0_0_1px_#2196F3] data-[state=checked]:bg-[#166534] md:text-[17px]';
const switchThumbClass =
  'absolute bottom-[0.3em] left-[0.3em] size-[1.4em] rounded-[8px] bg-white transition-transform duration-[400ms] group-data-[state=checked]:translate-x-[1.5em]';

type OrganizationOption = { code: string; name: string };

type Props = {
  actions: BudgetAction[];
  organizations: OrganizationOption[];
  /** Chaves "organizationCode|unitCode" de unidades marcadas como realocadas. */
  relocatedUnitKeys?: Set<string>;
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
  expanded,
  onToggle,
  onToggleExpand,
  onToggleLine,
}: OverviewActionRowProps) {
  const selected = selectionState !== 'none';
  const checkboxChecked =
    selectionState === 'full' ? true : selectionState === 'partial' ? 'indeterminate' : false;
  const minWidth = selectable ? 'min-w-[50rem]' : 'min-w-[48rem]';
  return (
    <div className={`w-full ${minWidth}`}>
      <Table className="table-fixed w-full">
        <TableBody>
          <TableRow
            data-state={selectable && selected ? 'selected' : undefined}
            onClick={selectable ? () => onToggle(action.id) : undefined}
            className={`data-[state=selected]:bg-muted/40 ${selectable ? 'cursor-pointer' : ''}`}
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
                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  organizations,
  relocatedUnitKeys,
}: Props) {
  const [organizationCode, setOrganizationCode] = useState(ALL);
  const [unitCode, setUnitCode] = useState(ALL);
  const [functionFilter, setFunctionFilter] = useState(ALL);
  const [subfunctionFilter, setSubfunctionFilter] = useState(ALL);
  const [theme, setTheme] = useState(ALL);
  const [onlyEmendas, setOnlyEmendas] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedLines, setSelectedLines] = useState<Map<string, Set<string>>>(() => new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [calculatorMode, setCalculatorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const tableMinWidth = calculatorMode ? 'min-w-[50rem]' : 'min-w-[48rem]';

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
    if (organizationCode === ALL) {
      const unitPart = selectedUnitLabel ? ` · ${selectedUnitLabel}` : '';
      return `${count} ação(ões) · todas as secretarias${unitPart}`;
    }
    const unitPart = showUnit ? ' · todas as unidades' : selectedUnitLabel ?? '—';
    return `${count} ação(ões) · ${selectedOrganization?.code ?? organizationCode} — ${selectedOrganization?.name ?? ''}${unitPart}`;
  }, [
    displayedActions.length,
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

  const handleOrganizationChange = useCallback((value: string) => {
    setOrganizationCode(value);
    setUnitCode(ALL);
    setSearch('');
  }, []);

  const hasActiveFilters =
    organizationCode !== ALL ||
    unitCode !== ALL ||
    functionFilter !== ALL ||
    subfunctionFilter !== ALL ||
    theme !== ALL ||
    onlyEmendas ||
    search.trim() !== '';

  const clearFilters = useCallback(() => {
    setOrganizationCode(ALL);
    setUnitCode(ALL);
    setFunctionFilter(ALL);
    setSubfunctionFilter(ALL);
    setTheme(ALL);
    setOnlyEmendas(false);
    setSearch('');
  }, []);

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

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ zoom: 0.85 }}>
      <CardHeader className="shrink-0">
        <CardTitle>
          {organizationCode === ALL
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
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden md:gap-4">
        <div className="flex shrink-0 flex-col gap-2 md:gap-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 md:gap-3">
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

        <div className="grid min-w-0 shrink-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5 md:gap-3">
          {[
            { label: 'Ações', value: displayedActions.length.toLocaleString('pt-BR') },
            { label: 'Planejado inicial', value: formatMoney(totals.initialBudget) },
            { label: 'Orçamento atualizado', value: formatMoney(totals.updatedBudget) },
            { label: 'Liquidado', value: formatMoney(totals.liquidated) },
            {
              label: 'Disponível',
              value: formatMoney(totals.updatedBudget - totals.liquidated),
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 border-0 bg-transparent p-0 md:rounded-lg md:border md:bg-muted/30 md:p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs">{stat.label}</p>
              <p className="truncate text-sm font-semibold tabular-nums md:mt-0.5 md:text-lg">{stat.value}</p>
            </div>
          ))}
        </div>

        {displayedActions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <DatabaseIcon />
              </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>Nenhuma ação encontrada</EmptyTitle>
            <EmptyDescription>Não há ações programadas para a seleção atual.</EmptyDescription>
          </Empty>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Separator className="shrink-0" />
            <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto">
              <Table className={`table-fixed w-full ${tableMinWidth}`}>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
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
                    <TableHead className="h-9 w-[36%] min-w-[12rem] bg-background text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Ação
                    </TableHead>
                    <TableHead className="h-9 w-[6rem] bg-background text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Órgão
                    </TableHead>
                    {showUnit ? (
                      <TableHead className="h-9 w-[15%] max-w-[9rem] bg-background text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Unidade
                      </TableHead>
                    ) : null}
                    <TableHead className="h-9 w-[7.5rem] bg-background text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Inicial
                    </TableHead>
                    <TableHead className="h-9 w-[7.5rem] bg-background text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Atualizado
                    </TableHead>
                    <TableHead className="h-9 w-[7.5rem] bg-background text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Liquidado
                    </TableHead>
                    <TableHead className="h-9 w-[7.5rem] bg-background text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Disponível
                    </TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
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
