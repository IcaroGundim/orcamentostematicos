'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DatabaseIcon, SearchIcon } from 'lucide-react';

import { ThemeBadge } from '@/components/domain/badges';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import { SearchableCombobox, type SearchableComboboxItem } from '@/components/domain/searchable-combobox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import type { BudgetAction } from '@/types/domain';

const ALL = 'ALL';
const ROW_GAP = 2;
const ROW_ESTIMATE = 74;

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
};

const OverviewActionRow = memo(function OverviewActionRow({ action, showUnit }: OverviewActionRowProps) {
  return (
    <Table className="table-fixed w-full min-w-[42rem]">
      <TableBody>
        <TableRow>
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
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (!actionMatchesFunctionalFilters(action, functionFilter, subfunctionFilter, ALL)) {
        return false;
      }
      return true;
    });
  }, [actions, organizationCode, unitCode, theme, functionFilter, subfunctionFilter]);

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

  const showUnit = unitCode === ALL;

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
              <Table className="table-fixed w-full min-w-[42rem]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
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
                className="relative w-full min-w-[42rem]"
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
                      <OverviewActionRow action={action} showUnit={showUnit} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
