'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
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
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { SourceBreakdownTable } from '@/components/domain/source-breakdown-table';
import { formatMoney, themeLabels } from '@/lib/api';
import {
  isWeightingFactorLocked,
  lockedWeightingFactorLabel,
  shouldHideWeightingFactor,
  weightingFactorFormValue,
} from '@/lib/classification-rules';
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

  /** Quando false, desabilita o botão de classificar. Padrão: true. */
  canEdit?: boolean;
  /** Quando false, desabilita o botão de remover. Padrão: true. */
  canRemove?: boolean;
}

const ALL = 'ALL';
const ACTION_ROW_GAP = 8;
const ACTION_ROW_ESTIMATE = 188;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

type CurationActionRowProps = {
  action: BudgetAction;
  isSelected: boolean;
  isExpanded: boolean;
  showOrgFilter: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
};

const CurationActionRow = memo(function CurationActionRow({
  action,
  isSelected,
  isExpanded,
  showOrgFilter,
  onSelect,
  onToggleExpand,
}: CurationActionRowProps) {
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

      <div className="min-w-0">
        <p className="break-words text-base font-semibold leading-6 text-primary group-hover/item:underline">
          {action.application}
        </p>
        <FunctionalProgramLine
          functionalProgram={action.functionalProgram}
          projectActivity={action.projectActivity}
          className="mt-0.5 truncate text-[11px] font-medium leading-4"
        />
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

type CurationActionsCardProps = {
  actions: BudgetAction[];
  organizations?: GovernmentOrganizationCatalog[];
  selectedActionId: string;
  expandedActionId: string | null;
  onSelectActionId: (id: string) => void;
  onExpandActionId: (id: string | null) => void;
};

const CurationActionsCard = memo(function CurationActionsCard({
  actions,
  organizations,
  selectedActionId,
  expandedActionId,
  onSelectActionId,
  onExpandActionId,
}: CurationActionsCardProps) {
  const [organizationFilter, setOrganizationFilter] = useState(ALL);
  const [unitFilter, setUnitFilter] = useState(ALL);
  const [actionFilter, setActionFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState(ALL);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const units = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const action of actions) {
      if (organizationFilter !== ALL && action.organizationCode !== organizationFilter) continue;
      if (!map.has(action.unitCode)) {
        map.set(action.unitCode, { code: action.unitCode, name: action.unitName });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [actions, organizationFilter]);

  const filteredActions = useMemo(() => {
    const search = normalize(actionFilter);
    return actions.filter((action) => {
      if (organizationFilter !== ALL && action.organizationCode !== organizationFilter) return false;
      if (unitFilter !== ALL && action.unitCode !== unitFilter) return false;
      if (themeFilter !== ALL && !action.assignments.some((item) => item.theme === themeFilter)) {
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
  }, [actions, actionFilter, themeFilter, unitFilter, organizationFilter]);

  const virtualizer = useVirtualizer({
    count: filteredActions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ACTION_ROW_ESTIMATE + ACTION_ROW_GAP,
    overscan: 8,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height + ACTION_ROW_GAP
        : undefined,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [expandedActionId, filteredActions.length]);

  const handleToggleExpand = useCallback(
    (actionId: string) => {
      onExpandActionId(expandedActionId === actionId ? null : actionId);
    },
    [expandedActionId, onExpandActionId],
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Ações</CardTitle>
        <CardDescription>
          {filteredActions.length} de {actions.length} ações no recorte atual
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showOrgFilter ? (
            <SearchableCombobox
              className="relative w-56"
              value={organizationFilter}
              onChange={(value) => {
                setOrganizationFilter(value);
                setUnitFilter(ALL);
              }}
              placeholder="Todos os órgãos"
              items={orgComboboxItems}
            />
          ) : null}
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value={ALL}>Todas as unidades</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unit.code} - {unit.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              className="w-64 pl-9"
              placeholder="Ação ou programa"
              autoComplete="off"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            />
          </div>
          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="w-40">
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
        </div>
      </CardHeader>
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
                        showOrgFilter={showOrgFilter}
                        onSelect={onSelectActionId}
                        onToggleExpand={handleToggleExpand}
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
    <Card className="min-w-0 gap-0">
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
      <CardContent className="pt-4">
        <FieldGroup>
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
  canEdit = true,
  canRemove = true,
}: Props) {
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId),
    [actions, selectedActionId],
  );

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
      <CurationActionsCard
        actions={actions}
        organizations={organizations}
        selectedActionId={selectedActionId}
        expandedActionId={expandedActionId}
        onSelectActionId={onSelectActionId}
        onExpandActionId={onExpandActionId}
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
