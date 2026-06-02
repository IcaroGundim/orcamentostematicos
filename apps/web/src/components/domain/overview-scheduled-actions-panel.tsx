'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CalculatorIcon, DatabaseIcon, SearchIcon, XIcon } from 'lucide-react';

import { ThemeBadge } from '@/components/domain/badges';
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
import type { BudgetAction } from '@/types/domain';

const ALL = 'ALL';
const ROW_GAP = 2;
const ROW_ESTIMATE = 74;

const switchTrackClass =
  'group relative inline-block h-[2em] w-[3.5em] shrink-0 cursor-pointer rounded-[10px] bg-[rgb(182,182,182)] text-[17px] outline-none transition-colors duration-[400ms] focus-visible:shadow-[0_0_1px_#2196F3] data-[state=checked]:bg-[#166534]';
const switchThumbClass =
  'absolute bottom-[0.3em] left-[0.3em] size-[1.4em] rounded-[8px] bg-white transition-transform duration-[400ms] group-data-[state=checked]:translate-x-[1.5em]';

type OrganizationOption = { code: string; name: string };

type Props = {
  actions: BudgetAction[];
  organizations: OrganizationOption[];
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
  selected: boolean;
  onToggle: (id: string) => void;
};

const OverviewActionRow = memo(function OverviewActionRow({
  action,
  showUnit,
  selectable,
  selected,
  onToggle,
}: OverviewActionRowProps) {
  return (
    <Table className={`table-fixed w-full ${selectable ? 'min-w-[44rem]' : 'min-w-[42rem]'}`}>
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
                checked={selected}
                onCheckedChange={() => onToggle(action.id)}
                aria-label={`Selecionar ${action.application}`}
              />
            </TableCell>
          ) : null}
          <TableCell className="w-[38%] min-w-[12rem] whitespace-normal break-words py-2 align-top">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium leading-snug">{action.application}</p>
              <FunctionalProgramLine
                functionalProgram={action.functionalProgram}
                projectActivity={action.projectActivity}
              >
                {action.assignments.map((item) => (
                  <ThemeBadge key={item.id} theme={item.theme} />
                ))}
              </FunctionalProgramLine>
            </div>
          </TableCell>
          {showUnit ? (
            <TableCell className="w-[18%] max-w-[10rem] py-2 align-top text-sm">
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
  );
});

export const OverviewScheduledActionsPanel = memo(function OverviewScheduledActionsPanel({
  actions,
  organizations,
}: Props) {
  const [organizationCode, setOrganizationCode] = useState(ALL);
  const [unitCode, setUnitCode] = useState(ALL);
  const [functionFilter, setFunctionFilter] = useState(ALL);
  const [subfunctionFilter, setSubfunctionFilter] = useState(ALL);
  const [theme, setTheme] = useState(ALL);
  const [onlyEmendas, setOnlyEmendas] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [calculatorMode, setCalculatorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const actionsById = useMemo(() => {
    const map = new Map<string, BudgetAction>();
    for (const action of actions) map.set(action.id, action);
    return map;
  }, [actions]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleCalculator = useCallback(() => {
    setCalculatorMode((enabled) => {
      if (enabled) setSelectedIds(new Set());
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

  const selectedCount = selectedIds.size;

  const selectedTotals = useMemo(() => {
    let initialBudget = 0;
    let updatedBudget = 0;
    let liquidated = 0;
    for (const id of selectedIds) {
      const action = actionsById.get(id);
      if (!action) continue;
      initialBudget += action.totals.initialBudget;
      updatedBudget += action.totals.updatedBudget;
      liquidated += action.totals.liquidated;
    }
    return { initialBudget, updatedBudget, liquidated };
  }, [selectedIds, actionsById]);

  const displayedSelectionState = useMemo<'none' | 'some' | 'all'>(() => {
    if (displayedActions.length === 0 || selectedIds.size === 0) return 'none';
    let selectedInView = 0;
    for (const action of displayedActions) {
      if (selectedIds.has(action.id)) selectedInView += 1;
    }
    if (selectedInView === 0) return 'none';
    return selectedInView === displayedActions.length ? 'all' : 'some';
  }, [displayedActions, selectedIds]);

  const toggleSelectDisplayed = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = displayedActions.every((action) => next.has(action.id));
      if (allSelected) {
        for (const action of displayedActions) next.delete(action.id);
      } else {
        for (const action of displayedActions) next.add(action.id);
      }
      return next;
    });
  }, [displayedActions]);

  const showUnit = unitCode === ALL;
  const tableMinWidth = calculatorMode ? 'min-w-[44rem]' : 'min-w-[42rem]';

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
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height + ROW_GAP
        : undefined,
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
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          <div className="flex items-center gap-3">
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
              aria-pressed={calculatorMode}
              onClick={toggleCalculator}
            >
              <CalculatorIcon />
              Somar
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              <XIcon />
              Limpar filtros
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
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

        <div className="grid min-w-0 shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
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
            <div key={stat.label} className="min-w-0 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{stat.value}</p>
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
                    <TableHead className="h-9 w-[38%] min-w-[12rem] bg-background text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Ação
                    </TableHead>
                    {showUnit ? (
                      <TableHead className="h-9 w-[18%] max-w-[10rem] bg-background text-xs uppercase tracking-[0.12em] text-muted-foreground">
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
                        selected={selectedIds.has(action.id)}
                        onToggle={toggleSelection}
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
