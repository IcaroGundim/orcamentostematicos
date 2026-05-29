'use client';

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderCogIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ThemeBadge } from '@/components/domain/badges';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/domain/searchable-combobox';
import { Separator } from '@/components/ui/separator';
import { BulkRemoveClassificationDialog } from '@/components/domain/bulk-remove-classification-dialog';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import type { BulkRemoveThemeFilter } from '@/lib/curation-actions';
import { SourceBreakdownTable } from '@/components/domain/source-breakdown-table';
import { formatMoney, themeLabels } from '@/lib/api';
import {
  isWeightingFactorLocked,
  lockedWeightingFactorLabel,
  shouldHideWeightingFactor,
  weightingFactorFormValue,
} from '@/lib/classification-rules';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import { cn } from '@/lib/utils';
import type {
  BudgetAction,
  GovernmentOrganizationCatalog,
  Metadata,
  ThemeBudget,
} from '@/types/domain';

export type AssignmentForm = {
  theme: ThemeBudget;
  axis: string;
  classification: string;
  weightingFactor: string;
  justification: string;
};

interface Props {
  actions: BudgetAction[];
  metadata: Metadata | null;
  /** Quando passado, exibe um filtro adicional de "Órgão" (uso SEPLAN). */
  organizations?: GovernmentOrganizationCatalog[];

  selectedActionId: string;
  onSelectActionId: (id: string) => void;
  expandedActionId: string | null;
  onExpandActionId: (id: string | null) => void;

  assignment: AssignmentForm;
  onAssignmentChange: (next: AssignmentForm) => void;
  selectedActionHasTheme: boolean;
  isRemovingAssignment: boolean;
  removePopoverOpen: boolean;
  onRemovePopoverOpenChange: (open: boolean) => void;
  assignmentIdsPendingRemoval: string[];
  onAssignmentIdsPendingRemovalChange: (ids: string[]) => void;
  onCreateAssignment: () => void | Promise<void>;
  onConfirmRemoveAssignment: () => void | Promise<void>;
  /** Habilita seleção e remoção em lote na lista de ações (uso SEPLAN). */
  bulkRemoveEnabled?: boolean;
  onConfirmBulkRemove?: (payload: {
    actionIds: string[];
    themeFilter: BulkRemoveThemeFilter;
  }) => void | Promise<void>;
  onBulkSelectionCleared?: () => void;

  /** Quando false, desabilita o botão de classificar. Padrão: true. */
  canEdit?: boolean;
  /** Quando false, desabilita o botão de remover. Padrão: true. */
  canRemove?: boolean;
}

const ALL = 'ALL';
/** Separa órgão e unidade no valor do filtro quando o recorte é "Todos os órgãos". */
const UNIT_FILTER_SCOPE_SEP = '|';

function makeScopedUnitFilterValue(organizationCode: string, unitCode: string) {
  return `${organizationCode}${UNIT_FILTER_SCOPE_SEP}${unitCode}`;
}

function parseScopedUnitFilterValue(value: string) {
  if (!value.includes(UNIT_FILTER_SCOPE_SEP)) return null;
  const [organizationCode, unitCode] = value.split(UNIT_FILTER_SCOPE_SEP, 2);
  if (!organizationCode || !unitCode) return null;
  return { organizationCode, unitCode };
}

function resolveUnitCodeForFilter(unitFilter: string, organizationFilter: string) {
  if (unitFilter === ALL) return null;
  if (organizationFilter !== ALL) return unitFilter;
  return parseScopedUnitFilterValue(unitFilter)?.unitCode ?? unitFilter;
}

function actionMatchesUnitFilter(
  action: BudgetAction,
  unitFilter: string,
  organizationFilter: string,
) {
  const unitCode = resolveUnitCodeForFilter(unitFilter, organizationFilter);
  if (!unitCode) return true;
  if (organizationFilter !== ALL) {
    return action.unitCode === unitCode;
  }
  return action.unitCode === unitCode;
}

const ACTION_ROW_GAP = 8;
const ACTION_ROW_ESTIMATE = 188;
const SOURCE_TABLE_HEADER_HEIGHT = 36;
const SOURCE_TABLE_ROW_HEIGHT = 32;
const SOURCE_TABLE_FOOTER_HEIGHT = 40;
const SOURCE_TABLE_EMPTY_HEIGHT = 52;
const SOURCE_TABLE_MAX_HEIGHT = 320;
const SOURCE_TABLE_SECTION_GAP = 8;

function countDistinctSources(action: BudgetAction) {
  const sources = new Set<string>();
  for (const line of action.expenseLines ?? []) {
    sources.add(line.source?.trim() || 'Sem fonte');
  }
  return sources.size;
}

function estimateSourceTableHeight(action: BudgetAction) {
  const count = countDistinctSources(action);
  if (count === 0) return SOURCE_TABLE_EMPTY_HEIGHT;
  const tableHeight =
    SOURCE_TABLE_HEADER_HEIGHT + count * SOURCE_TABLE_ROW_HEIGHT + SOURCE_TABLE_FOOTER_HEIGHT;
  return Math.min(tableHeight, SOURCE_TABLE_MAX_HEIGHT) + SOURCE_TABLE_SECTION_GAP;
}

function estimateActionRowSize(action: BudgetAction, isExpanded: boolean) {
  if (!isExpanded) return ACTION_ROW_ESTIMATE;
  return ACTION_ROW_ESTIMATE + estimateSourceTableHeight(action);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

type ActionBulkSelectChipProps = {
  application: string;
  hasAssignments: boolean;
  isSelected: boolean;
  onChange: (checked: boolean) => void;
};

function ActionBulkSelectChip({
  application,
  hasAssignments,
  isSelected,
  onChange,
}: ActionBulkSelectChipProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 px-2 py-1 shadow-sm transition-colors',
        hasAssignments
          ? isSelected
            ? 'border-primary bg-background text-primary ring-2 ring-primary/30'
            : 'border-primary/35 bg-background text-primary hover:border-primary hover:bg-muted/40'
          : 'cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-50',
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="sr-only"
        aria-label={`Selecionar ${application} para remoção em lote`}
        checked={isSelected}
        disabled={!hasAssignments}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.checked);
        }}
      />
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm border-2',
          hasAssignments && isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : hasAssignments
              ? 'border-primary/60 bg-background'
              : 'border-muted-foreground/40 bg-muted',
        )}
      >
        {isSelected && hasAssignments ? <CheckIcon className="size-3 stroke-[3]" /> : null}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide">
        {hasAssignments ? (isSelected ? 'Selecionada' : 'Selecionar') : 'Sem tema'}
      </span>
    </label>
  );
}

type CurationActionRowProps = {
  action: BudgetAction;
  isSelected: boolean;
  isExpanded: boolean;
  isBulkSelected: boolean;
  showOrgFilter: boolean;
  showBulkSelect: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onBulkSelectChange: (id: string, checked: boolean) => void;
};

const CurationActionRow = memo(function CurationActionRow({
  action,
  isSelected,
  isExpanded,
  isBulkSelected,
  showOrgFilter,
  showBulkSelect,
  onSelect,
  onToggleExpand,
  onBulkSelectChange,
}: CurationActionRowProps) {
  const hasAssignments = action.assignments.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(action.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(action.id);
        }
      }}
      aria-pressed={isSelected}
      className={cn(
        'group/item flex w-full cursor-pointer flex-col gap-2 rounded-lg border-2 border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:border-primary focus-visible:bg-muted/50 focus-visible:outline-none',
        isSelected && 'border-primary bg-primary/5 hover:bg-primary/5',
        isBulkSelected && !isSelected && 'border-primary/50 bg-primary/[0.03]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            {action.unitCode}
          </span>
          <span
            className="truncate text-[11px] text-muted-foreground"
            title={`${action.organizationCode} - ${action.organizationName} · ${action.unitName}`}
          >
            {showOrgFilter ? `${action.organizationCode} · ` : ''}
            {action.unitName}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {action.assignments.length ? (
            action.assignments.map((item) => <ThemeBadge key={item.id} theme={item.theme} />)
          ) : (
            <Badge variant="secondary">Sem tema</Badge>
          )}
          <button
            type="button"
            aria-label={isExpanded ? 'Ocultar fontes' : 'Mostrar fontes'}
            aria-expanded={isExpanded}
            title={isExpanded ? 'Ocultar fontes' : 'Mostrar fontes'}
            className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(action.id);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {isExpanded ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'min-w-0 gap-2',
          showBulkSelect
            ? 'grid grid-cols-1 items-start sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3'
            : 'flex flex-col',
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <p className="break-words text-base font-semibold leading-snug text-primary group-hover/item:underline">
            {action.application}
          </p>
          <FunctionalProgramLine
            functionalProgram={action.functionalProgram}
            projectActivity={action.projectActivity}
            className="truncate text-[11px] font-medium leading-4 text-muted-foreground"
          />
        </div>
        {showBulkSelect ? (
          <div className="flex justify-end sm:self-center sm:justify-start">
            <ActionBulkSelectChip
              application={action.application}
              hasAssignments={hasAssignments}
              isSelected={isBulkSelected}
              onChange={(checked) => onBulkSelectChange(action.id, checked)}
            />
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-md border border-border/60 bg-background">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Inicial</dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(action.totals.initialBudget)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Atualizado</dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(action.totals.updatedBudget)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Liquidado</dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(action.totals.liquidated)}
          </dd>
        </div>
      </dl>

      {isExpanded ? (
        <div onClick={(e) => e.stopPropagation()}>
          <SourceBreakdownTable action={action} />
        </div>
      ) : null}
    </div>
  );
});

type CurationBulkSelectionToolbarProps = {
  isRemoving: boolean;
  canSelectInFilter: boolean;
  canSelectVisible: boolean;
  hasSelection: boolean;
  onSelectInFilter: () => void;
  onSelectVisible: () => void;
  onClear: () => void;
  onRemove: () => void;
};

function CurationBulkSelectionToolbar({
  isRemoving,
  canSelectInFilter,
  canSelectVisible,
  hasSelection,
  onSelectInFilter,
  onSelectVisible,
  onClear,
  onRemove,
}: CurationBulkSelectionToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Seleção em lote"
      className="inline-flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-border bg-background p-1.5 shadow-sm"
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 bg-background"
        disabled={isRemoving || !canSelectInFilter}
        onClick={onSelectInFilter}
      >
        Marcar classificadas no recorte
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 bg-background"
        disabled={isRemoving || !canSelectVisible}
        onClick={onSelectVisible}
      >
        Marcar visíveis
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8"
        disabled={isRemoving || !hasSelection}
        onClick={onClear}
      >
        Limpar seleção
      </Button>
      <Separator orientation="vertical" className="hidden h-7 sm:block" />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-8"
        disabled={isRemoving || !hasSelection}
        onClick={onRemove}
      >
        <Trash2Icon data-icon="inline-start" />
        Remover em lote
      </Button>
    </div>
  );
}

type CurationUnitOption = {
  code: string;
  name: string;
  organizationCode?: string;
};

type CurationActionsFiltersProps = {
  actions: BudgetAction[];
  showOrgFilter: boolean;
  organizationFilter: string;
  onOrganizationFilterChange: (value: string) => void;
  orgComboboxItems: SearchableComboboxItem[];
  unitFilter: string;
  onUnitFilterChange: (value: string) => void;
  units: CurationUnitOption[];
  functionFilter: string;
  onFunctionFilterChange: (value: string) => void;
  subfunctionFilter: string;
  onSubfunctionFilterChange: (value: string) => void;
  actionFilter: string;
  onActionFilterChange: (value: string) => void;
  themeFilter: string;
  onThemeFilterChange: (value: string) => void;
};

const themeComboboxItems: SearchableComboboxItem[] = [
  { value: ALL, label: 'Todos os temas' },
  ...Object.entries(themeLabels).map(([key, label]) => ({ value: key, label })),
];

function CurationActionsFilters({
  actions,
  showOrgFilter,
  organizationFilter,
  onOrganizationFilterChange,
  orgComboboxItems,
  unitFilter,
  onUnitFilterChange,
  units,
  functionFilter,
  onFunctionFilterChange,
  subfunctionFilter,
  onSubfunctionFilterChange,
  actionFilter,
  onActionFilterChange,
  themeFilter,
  onThemeFilterChange,
}: CurationActionsFiltersProps) {
  const unitComboboxItems = useMemo<SearchableComboboxItem[]>(() => {
    const options: SearchableComboboxItem[] = [{ value: ALL, label: 'Todas as unidades' }];
    const listAllOrgUnits = showOrgFilter && organizationFilter === ALL;

    for (const unit of units) {
      if (listAllOrgUnits && unit.organizationCode) {
        options.push({
          value: makeScopedUnitFilterValue(unit.organizationCode, unit.code),
          label: `${unit.organizationCode} · ${unit.code} - ${unit.name}`,
        });
      } else {
        options.push({
          value: unit.code,
          label: `${unit.code} - ${unit.name}`,
        });
      }
    }

    return options;
  }, [units, organizationFilter, showOrgFilter]);

  return (
    <div className="w-full border-t border-border/60 bg-background px-3 py-3">
      <div className="flex w-full flex-col gap-3">
        <div
          className={cn(
            'grid w-full gap-3',
            showOrgFilter
              ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'
              : 'sm:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {showOrgFilter ? (
            <Field className="min-w-0 gap-1.5">
              <FieldLabel className={filterFieldLabelClass}>Órgão</FieldLabel>
              <SearchableCombobox
                className="relative w-full"
                value={organizationFilter}
                onChange={onOrganizationFilterChange}
                placeholder="Todos os órgãos"
                items={orgComboboxItems}
              />
            </Field>
          ) : null}
          <Field className="min-w-0 gap-1.5">
            <FieldLabel className={filterFieldLabelClass}>Unidade</FieldLabel>
            <SearchableCombobox
              className="relative w-full"
              value={unitFilter}
              onChange={onUnitFilterChange}
              placeholder="Todas as unidades"
              items={unitComboboxItems}
            />
          </Field>
          <FunctionalClassificationFilters
            actions={actions}
            functionFilter={functionFilter}
            subfunctionFilter={subfunctionFilter}
            onFunctionChange={onFunctionFilterChange}
            onSubfunctionChange={onSubfunctionFilterChange}
            allValue={ALL}
          />
        </div>
        <div
          className={cn(
            'grid w-full gap-3',
            'sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]',
          )}
        >
          <Field className="min-w-0 gap-1.5">
            <FieldLabel className={filterFieldLabelClass}>Busca</FieldLabel>
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                className="w-full pl-9"
                placeholder="Ação ou programa"
                autoComplete="off"
                value={actionFilter}
                onChange={(event) => onActionFilterChange(event.target.value)}
              />
            </div>
          </Field>
          <Field className="min-w-0 gap-1.5">
            <FieldLabel className={filterFieldLabelClass}>Tema</FieldLabel>
            <SearchableCombobox
              className="relative w-full"
              value={themeFilter}
              onChange={onThemeFilterChange}
              placeholder="Todos os temas"
              items={themeComboboxItems}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

type CurationActionsCardProps = {
  actions: BudgetAction[];
  organizations?: GovernmentOrganizationCatalog[];
  selectedActionId: string;
  expandedActionId: string | null;
  onSelectActionId: (id: string) => void;
  onExpandActionId: (id: string | null) => void;
  isRemovingAssignment: boolean;
  canRemove: boolean;
  onConfirmBulkRemove: (payload: {
    actionIds: string[];
    themeFilter: BulkRemoveThemeFilter;
  }) => void | Promise<void>;
  onBulkSelectionCleared?: () => void;
};

const CurationActionsCard = memo(function CurationActionsCard({
  actions,
  organizations,
  selectedActionId,
  expandedActionId,
  onSelectActionId,
  onExpandActionId,
  isRemovingAssignment,
  canRemove,
  onConfirmBulkRemove,
  onBulkSelectionCleared,
}: CurationActionsCardProps) {
  const [organizationFilter, setOrganizationFilter] = useState(ALL);
  const [unitFilter, setUnitFilter] = useState(ALL);
  const [functionFilter, setFunctionFilter] = useState(ALL);
  const [subfunctionFilter, setSubfunctionFilter] = useState(ALL);
  const [actionFilter, setActionFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState(ALL);
  const [bulkSelectedActionIds, setBulkSelectedActionIds] = useState<Set<string>>(() => new Set());
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevExpandedIdRef = useRef<string | null>(null);

  const showOrgFilter = !!organizations;

  const orgComboboxItems = useMemo(
    () => [
      { value: ALL, label: 'Todos os órgãos' },
      ...(organizations ?? []).map((org) => ({
        value: org.code,
        label: `${org.code} - ${org.name}`,
      })),
    ],
    [organizations],
  );

  const units = useMemo((): CurationUnitOption[] => {
    if (organizationFilter !== ALL) {
      const map = new Map<string, CurationUnitOption>();
      for (const action of actions) {
        if (action.organizationCode !== organizationFilter) continue;
        if (!map.has(action.unitCode)) {
          map.set(action.unitCode, { code: action.unitCode, name: action.unitName });
        }
      }
      return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    }

    if (!showOrgFilter) {
      const map = new Map<string, CurationUnitOption>();
      for (const action of actions) {
        if (!map.has(action.unitCode)) {
          map.set(action.unitCode, { code: action.unitCode, name: action.unitName });
        }
      }
      return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    }

    const map = new Map<string, CurationUnitOption & { organizationCode: string }>();
    for (const action of actions) {
      const key = `${action.organizationCode}${UNIT_FILTER_SCOPE_SEP}${action.unitCode}`;
      if (!map.has(key)) {
        map.set(key, {
          organizationCode: action.organizationCode,
          code: action.unitCode,
          name: action.unitName,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`),
    );
  }, [actions, organizationFilter, showOrgFilter]);

  const filteredActions = useMemo(() => {
    const search = normalize(actionFilter);
    return actions.filter((action) => {
      if (organizationFilter !== ALL && action.organizationCode !== organizationFilter) return false;
      if (!actionMatchesUnitFilter(action, unitFilter, organizationFilter)) return false;
      if (themeFilter !== ALL && !action.assignments.some((item) => item.theme === themeFilter)) {
        return false;
      }
      if (!actionMatchesFunctionalFilters(action, functionFilter, subfunctionFilter, ALL)) {
        return false;
      }
      if (!search) return true;
      return [
        action.application,
        action.functionalProgram,
        action.projectActivity,
        action.organizationName,
        action.unitName,
      ].some((value) => normalize(value).includes(search));
    });
  }, [actions, actionFilter, themeFilter, unitFilter, organizationFilter, functionFilter, subfunctionFilter]);

  const virtualizer = useVirtualizer({
    count: filteredActions.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => filteredActions[index]?.id ?? index,
    estimateSize: (index) => {
      const action = filteredActions[index];
      if (!action) return ACTION_ROW_ESTIMATE;
      return estimateActionRowSize(action, expandedActionId === action.id);
    },
    gap: ACTION_ROW_GAP,
    overscan: 8,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  useLayoutEffect(() => {
    const indicesToMeasure = new Set<number>();

    if (expandedActionId) {
      const expandedIndex = filteredActions.findIndex((action) => action.id === expandedActionId);
      if (expandedIndex >= 0) indicesToMeasure.add(expandedIndex);
    }

    const previousExpandedId = prevExpandedIdRef.current;
    if (previousExpandedId && previousExpandedId !== expandedActionId) {
      const collapsedIndex = filteredActions.findIndex((action) => action.id === previousExpandedId);
      if (collapsedIndex >= 0) indicesToMeasure.add(collapsedIndex);
    }

    prevExpandedIdRef.current = expandedActionId;

    if (indicesToMeasure.size === 0) return;

    const frame = requestAnimationFrame(() => {
      for (const index of indicesToMeasure) {
        const node = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
        if (node) virtualizer.measureElement(node);
      }
    });

    return () => cancelAnimationFrame(frame);
    // virtualizer.measureElement is stable; omit virtualizer to avoid remeasure every render
  }, [expandedActionId, filteredActions]);

  const handleToggleExpand = useCallback(
    (actionId: string) => {
      onExpandActionId(expandedActionId === actionId ? null : actionId);
    },
    [expandedActionId, onExpandActionId],
  );

  const bulkSelectedActions = useMemo(
    () => actions.filter((action) => bulkSelectedActionIds.has(action.id)),
    [actions, bulkSelectedActionIds],
  );

  const bulkEligibleInFilter = useMemo(
    () => filteredActions.filter((action) => action.assignments.length > 0),
    [filteredActions],
  );

  const handleBulkSelectChange = useCallback((actionId: string, checked: boolean) => {
    setBulkSelectedActionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(actionId);
      else next.delete(actionId);
      return next;
    });
  }, []);

  const selectClassifiedInFilter = useCallback(() => {
    setBulkSelectedActionIds(new Set(bulkEligibleInFilter.map((action) => action.id)));
  }, [bulkEligibleInFilter]);

  const selectVisibleClassified = useCallback(() => {
    const visibleIds = new Set(
      virtualizer
        .getVirtualItems()
        .map((row) => filteredActions[row.index])
        .filter((action): action is BudgetAction => !!action && action.assignments.length > 0)
        .map((action) => action.id),
    );
    setBulkSelectedActionIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [filteredActions, virtualizer]);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedActionIds(new Set());
    onBulkSelectionCleared?.();
  }, [onBulkSelectionCleared]);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-0 border-b border-border/70 px-0 pb-0">
        <div className="grid w-full grid-cols-1 gap-3 px-3 pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div className="min-w-0">
            <CardTitle>Ações</CardTitle>
            <CardDescription className="mt-0.5">
              {filteredActions.length} de {actions.length} ações no recorte atual
            </CardDescription>
          </div>
          {canRemove ? (
            <div className="flex w-full justify-end md:w-auto md:justify-self-end">
              <CurationBulkSelectionToolbar
                isRemoving={isRemovingAssignment}
                canSelectInFilter={bulkEligibleInFilter.length > 0}
                canSelectVisible={filteredActions.some((action) => action.assignments.length > 0)}
                hasSelection={bulkSelectedActionIds.size > 0}
                onSelectInFilter={selectClassifiedInFilter}
                onSelectVisible={selectVisibleClassified}
                onClear={clearBulkSelection}
                onRemove={() => setBulkRemoveDialogOpen(true)}
              />
            </div>
          ) : null}
        </div>
        <CurationActionsFilters
          actions={actions}
          showOrgFilter={showOrgFilter}
          organizationFilter={organizationFilter}
          onOrganizationFilterChange={(value) => {
            setOrganizationFilter(value);
            setUnitFilter(ALL);
          }}
          orgComboboxItems={orgComboboxItems}
          unitFilter={unitFilter}
          onUnitFilterChange={setUnitFilter}
          units={units}
          functionFilter={functionFilter}
          onFunctionFilterChange={setFunctionFilter}
          subfunctionFilter={subfunctionFilter}
          onSubfunctionFilterChange={setSubfunctionFilter}
          actionFilter={actionFilter}
          onActionFilterChange={setActionFilter}
          themeFilter={themeFilter}
          onThemeFilterChange={setThemeFilter}
        />
      </CardHeader>
      <BulkRemoveClassificationDialog
        open={bulkRemoveDialogOpen}
        onOpenChange={setBulkRemoveDialogOpen}
        selectedActions={bulkSelectedActions}
        isRemoving={isRemovingAssignment}
        onConfirm={async (themeFilter) => {
          if (!onConfirmBulkRemove) return;
          await onConfirmBulkRemove({
            actionIds: [...bulkSelectedActionIds],
            themeFilter,
          });
          setBulkRemoveDialogOpen(false);
          clearBulkSelection();
        }}
      />
      <CardContent className="p-0">
        {actions.length ? (
          <>
            <div ref={scrollRef} className="h-[700px] overflow-auto">
              <ul
                role="list"
                className="relative w-full p-3"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const action = filteredActions[virtualRow.index];
                  if (!action) return null;
                  return (
                    <li
                      key={action.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full px-3"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <CurationActionRow
                        action={action}
                        isSelected={selectedActionId === action.id}
                        isExpanded={expandedActionId === action.id}
                        isBulkSelected={bulkSelectedActionIds.has(action.id)}
                        showOrgFilter={showOrgFilter}
                        showBulkSelect={canRemove}
                        onSelect={onSelectActionId}
                        onToggleExpand={handleToggleExpand}
                        onBulkSelectChange={handleBulkSelectChange}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
            {filteredActions.length === 0 ? (
              <div className="px-4 pb-4">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma ação encontrada</EmptyTitle>
                    <EmptyDescription>
                      Ajuste os filtros para consultar as ações disponíveis.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : null}
          </>
        ) : (
          <div className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderCogIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma ação disponível</EmptyTitle>
                <EmptyDescription>Não há ações no QDD vigente.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

type CurationAssignmentCardProps = {
  selectedAction: BudgetAction | undefined;
  metadata: Metadata | null;
  assignment: AssignmentForm;
  onAssignmentChange: (next: AssignmentForm) => void;
  selectedActionHasTheme: boolean;
  isRemovingAssignment: boolean;
  removePopoverOpen: boolean;
  onRemovePopoverOpenChange: (open: boolean) => void;
  assignmentIdsPendingRemoval: string[];
  onAssignmentIdsPendingRemovalChange: (ids: string[]) => void;
  onCreateAssignment: () => void | Promise<void>;
  onConfirmRemoveAssignment: () => void | Promise<void>;
  canEdit: boolean;
  canRemove: boolean;
  selectedActionId: string;
};

const CurationAssignmentCard = memo(function CurationAssignmentCard({
  selectedAction,
  metadata,
  assignment,
  onAssignmentChange,
  selectedActionHasTheme,
  isRemovingAssignment,
  removePopoverOpen,
  onRemovePopoverOpenChange,
  assignmentIdsPendingRemoval,
  onAssignmentIdsPendingRemovalChange,
  onCreateAssignment,
  onConfirmRemoveAssignment,
  canEdit,
  canRemove,
  selectedActionId,
}: CurationAssignmentCardProps) {
  const axes = metadata?.axes[assignment.theme] ?? [];
  const classifications = metadata?.classifications[assignment.theme] ?? [];

  return (
    <Card className="h-fit min-w-0 gap-0 self-start">
      <CardHeader className="relative z-10 border-b border-border bg-card shadow-sm">
        <CardTitle className="font-sans text-base font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">
          Classificação da Ação
        </CardTitle>
        <CardDescription className="mt-3">
          {selectedAction ? (
            <span className="flex flex-col gap-1 rounded-lg border border-primary/20 bg-primary/5 py-1.5 pl-2 pr-3">
              <span className="text-sm font-semibold text-foreground">{selectedAction.application}</span>
              <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">
                {selectedAction.projectActivity}
              </span>
            </span>
          ) : (
            'Selecione uma ação.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-4">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel>Tema</FieldLabel>
            <Select
              value={assignment.theme}
              onValueChange={(value) =>
                onAssignmentChange({
                  ...assignment,
                  theme: value as ThemeBudget,
                  axis: '',
                  classification: '',
                  weightingFactor: '',
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {metadata?.themes.map((theme) => (
                    <SelectItem key={theme} value={theme}>
                      {themeLabels[theme]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field data-disabled={selectedActionHasTheme || undefined}>
            <FieldLabel>Eixo</FieldLabel>
            <Select
              value={assignment.axis || 'UNSELECTED'}
              disabled={selectedActionHasTheme}
              onValueChange={(value) =>
                onAssignmentChange({
                  ...assignment,
                  axis: value === 'UNSELECTED' ? '' : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="UNSELECTED">Selecione</SelectItem>
                  {axes.map((axis) => (
                    <SelectItem key={axis.value} value={axis.value}>
                      {axis.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field data-disabled={selectedActionHasTheme || undefined}>
            <FieldLabel>Classificação</FieldLabel>
            <Select
              value={assignment.classification || 'UNSELECTED'}
              disabled={selectedActionHasTheme}
              onValueChange={(value) => {
                const classification = value === 'UNSELECTED' ? '' : value;
                onAssignmentChange({
                  ...assignment,
                  classification,
                  weightingFactor: weightingFactorFormValue(assignment.theme, classification, ''),
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="UNSELECTED">Selecione</SelectItem>
                  {classifications.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {shouldHideWeightingFactor(assignment.theme, assignment.classification) ? (
            lockedWeightingFactorLabel(assignment.theme, assignment.classification) ? (
              <Field>
                <FieldDescription>
                  {lockedWeightingFactorLabel(assignment.theme, assignment.classification)}
                </FieldDescription>
              </Field>
            ) : null
          ) : (
            <Field
              data-disabled={
                selectedActionHasTheme ||
                isWeightingFactorLocked(assignment.theme, assignment.classification) ||
                undefined
              }
            >
              <FieldLabel htmlFor="weightingFactor">Ponderador</FieldLabel>
              <Input
                id="weightingFactor"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={weightingFactorFormValue(
                  assignment.theme,
                  assignment.classification,
                  assignment.weightingFactor,
                )}
                disabled={
                  selectedActionHasTheme ||
                  isWeightingFactorLocked(assignment.theme, assignment.classification)
                }
                onChange={(event) =>
                  onAssignmentChange({ ...assignment, weightingFactor: event.target.value })
                }
                placeholder="Opcional"
              />
              {lockedWeightingFactorLabel(assignment.theme, assignment.classification) ? (
                <FieldDescription>
                  {lockedWeightingFactorLabel(assignment.theme, assignment.classification)}
                </FieldDescription>
              ) : null}
            </Field>
          )}
          <Field data-disabled={selectedActionHasTheme || undefined}>
            <FieldLabel htmlFor="justification">
              Justificativa <span className="text-muted-foreground font-normal">(opcional)</span>
            </FieldLabel>
            <Textarea
              id="justification"
              disabled={selectedActionHasTheme}
              value={assignment.justification}
              onChange={(event) =>
                onAssignmentChange({ ...assignment, justification: event.target.value })
              }
            />
          </Field>
          {selectedActionHasTheme ? (
            <Alert className="border-primary/25 bg-primary/5">
              <FolderCogIcon />
              <AlertDescription className="text-xs">
                Os campos acima mostram a classificação gravada para{' '}
                <strong>{themeLabels[assignment.theme]}</strong> (somente leitura). Para alterar,
                use &quot;Remover classificação&quot; e classifique novamente — só é possível
                quando não houver validações com dados preenchidos.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                !canEdit ||
                !selectedActionId ||
                !assignment.axis ||
                !assignment.classification ||
                selectedActionHasTheme ||
                isRemovingAssignment
              }
              onClick={() => void onCreateAssignment()}
            >
              <FolderCogIcon data-icon="inline-start" />
              Classificar ação
            </Button>
            {(selectedAction?.assignments.length ?? 0) > 0 && selectedActionId ? (
              <RemoveClassificationPopover
                open={removePopoverOpen}
                onOpenChange={onRemovePopoverOpenChange}
                metadata={metadata}
                selectedAction={selectedAction ?? null}
                selectedAssignmentIds={assignmentIdsPendingRemoval}
                onSelectedAssignmentIdsChange={onAssignmentIdsPendingRemovalChange}
                isRemovingAssignment={isRemovingAssignment}
                onConfirmRemove={onConfirmRemoveAssignment}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isRemovingAssignment || !canRemove}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Remover classificação
                </Button>
              </RemoveClassificationPopover>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
});

export function ThematicCurationPanel({
  actions,
  metadata,
  organizations,
  selectedActionId,
  onSelectActionId,
  expandedActionId,
  onExpandActionId,
  assignment,
  onAssignmentChange,
  selectedActionHasTheme,
  isRemovingAssignment,
  removePopoverOpen,
  onRemovePopoverOpenChange,
  assignmentIdsPendingRemoval,
  onAssignmentIdsPendingRemovalChange,
  onCreateAssignment,
  onConfirmRemoveAssignment,
  bulkRemoveEnabled = false,
  onConfirmBulkRemove,
  onBulkSelectionCleared,
  canEdit = true,
  canRemove = true,
}: Props) {
  const showBulkRemove = bulkRemoveEnabled && canRemove && !!onConfirmBulkRemove;
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId),
    [actions, selectedActionId],
  );

  return (
    <section className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
      <CurationActionsCard
        actions={actions}
        organizations={organizations}
        selectedActionId={selectedActionId}
        expandedActionId={expandedActionId}
        onSelectActionId={onSelectActionId}
        onExpandActionId={onExpandActionId}
        isRemovingAssignment={isRemovingAssignment}
        canRemove={showBulkRemove}
        onConfirmBulkRemove={onConfirmBulkRemove!}
        onBulkSelectionCleared={onBulkSelectionCleared}
      />
      <CurationAssignmentCard
        selectedAction={selectedAction}
        metadata={metadata}
        assignment={assignment}
        onAssignmentChange={onAssignmentChange}
        selectedActionHasTheme={selectedActionHasTheme}
        isRemovingAssignment={isRemovingAssignment}
        removePopoverOpen={removePopoverOpen}
        onRemovePopoverOpenChange={onRemovePopoverOpenChange}
        assignmentIdsPendingRemoval={assignmentIdsPendingRemoval}
        onAssignmentIdsPendingRemovalChange={onAssignmentIdsPendingRemovalChange}
        onCreateAssignment={onCreateAssignment}
        onConfirmRemoveAssignment={onConfirmRemoveAssignment}
        canEdit={canEdit}
        canRemove={canRemove}
        selectedActionId={selectedActionId}
      />
    </section>
  );
}
