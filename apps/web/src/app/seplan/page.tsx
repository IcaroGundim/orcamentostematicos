'use client';

import {
  BarChart3Icon,
  BookOpenIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FileBarChart2Icon,
  FileDownIcon,
  FileSpreadsheetIcon,
  FolderCogIcon,
  GaugeIcon,
  LogOutIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Cell, Pie, PieChart } from 'recharts';
import { ThemeLiquidatedSummaryChart } from '@/components/charts/ThemeLiquidatedSummaryChart';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AxisExecutionByThemePanel } from '@/components/domain/axis-execution-by-theme-panel';
import { DeliveryReviewList } from '@/components/domain/delivery-review-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels, type Session } from '@/lib/api';
import {
  isWeightingFactorLocked,
  lockedWeightingFactorLabel,
  resolveWeightingFactor,
  shouldHideWeightingFactor,
  weightingFactorFormValue,
} from '@/lib/classification-rules';
import {
  appendActionAssignment,
  decrementSummaryAssignments,
  fetchCurationSnapshot,
  incrementSummaryAssignments,
  patchActionAssignments,
} from '@/lib/curation-actions';
import {
  buildAxisExecutionReport,
  buildClassificationExecutionReport,
  filterAxisReportByTheme,
  themeAxisTotals,
} from '@/lib/thematic-axis-report';
import type { BudgetAction, BudgetImport, Metadata, QddPeriodType, Summary, ThematicAssignment, ThemeBudget, ValidationItem } from '@/types/domain';
import {
  buildResultsRows,
  defaultExportFilename,
  exportResultsCsv,
  exportResultsXlsx,
  type ResultsThemeSummary,
} from '@/lib/results-export';

type ImportPreview = {
  previewId: string;
  filename: string;
  year: number;
  referenceMonth: number;
  periodType: QddPeriodType;
  rowCount: number;
  actionCount: number;
  organizationsCount: number;
  unitsCount: number;
  sampleActions: BudgetAction[];
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatPeriod(referenceMonth: number, year: number, periodType: QddPeriodType) {
  const month = MONTH_NAMES[referenceMonth - 1] ?? '';
  return periodType === 'ACUMULADO_ANUAL'
    ? `Jan–${month}/${year}`
    : `${month}/${year}`;
}

type SectionId = 'overview' | 'structure' | 'curation' | 'cycles' | 'review' | 'results' | 'reports';

type ActionsTabFilters = {
  organizationCode: string;
  unitCode: string;
};

type ActionColumnFilters = {
  organizationCode: string;
  application: string;
  theme: string;
};

const allValue = 'ALL';

const initialAssignment = {
  actionId: '',
  theme: 'OSG' as ThemeBudget,
  axis: '',
  classification: '',
  weightingFactor: '',
  justification: '',
};

const initialActionsFilters: ActionsTabFilters = {
  organizationCode: allValue,
  unitCode: allValue,
};

function gaugeColor(pct: number): string {
  if (pct >= 75) return 'var(--color-chart-1)';
  if (pct >= 40) return 'var(--color-chart-3)';
  return 'var(--color-chart-4)';
}

export default function SeplanPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importHistory, setImportHistory] = useState<BudgetImport[]>([]);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [deletingImportId, setDeletingImportId] = useState('');
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [removePopoverOpen, setRemovePopoverOpen] = useState(false);
  const [assignmentIdsPendingRemoval, setAssignmentIdsPendingRemoval] = useState<string[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedPeriodType, setSelectedPeriodType] = useState<QddPeriodType>('ACUMULADO_ANUAL');
  const [selectedReferenceMonth, setSelectedReferenceMonth] = useState(new Date().getMonth() + 1);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [assignment, setAssignment] = useState(initialAssignment);
  const [filter, setFilter] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [actionsFilters, setActionsFilters] = useState<ActionsTabFilters>(initialActionsFilters);
  const [actionsSearch, setActionsSearch] = useState('');
  const [structureTab, setStructureTab] = useState<'management' | 'actions'>('management');
  const [columnFilters, setColumnFilters] = useState<ActionColumnFilters>({
    organizationCode: allValue,
    application: '',
    theme: allValue,
  });
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const [qddPopoverOpen, setQddPopoverOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [managementCardsHeight, setManagementCardsHeight] = useState<number | null>(null);
  const managementCardsRef = useRef<HTMLDivElement | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedResultRows, setExpandedResultRows] = useState<Set<string>>(new Set());
  const [reportsViewTab, setReportsViewTab] = useState<'overview' | 'by-axis'>('overview');
  const [reportsThemeTab, setReportsThemeTab] = useState<ThemeBudget>('OCAD');

  function toggleResultRow(id: string) {
    setExpandedResultRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleOrg(code: string) {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    clearStoredSession();
    router.push('/login');
  }

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role === 'SECRETARIA_REPRESENTANTE') {
      router.push('/secretaria');
      return;
    }
    setSession(session);
    load().catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados. O servidor pode estar indisponível.');
    });
  }, [router]);

  async function load() {
    const [meta, summaryData, actionData, validationData, importsData] = await Promise.all([
      api<Metadata>('/metadata'),
      api<Summary>('/reports/summary'),
      api<BudgetAction[]>('/budget-actions'),
      api<ValidationItem[]>('/validations/my'),
      api<BudgetImport[]>('/imports/qdd'),
    ]);
    setMetadata(meta);
    setSummary(summaryData);
    setActions(actionData);
    setValidations(validationData);
    setImportHistory(importsData);
    const firstAction = actionData[0]?.id ?? '';
    setSelectedActionId((current) => current || firstAction);
    setAssignment((current) => ({ ...current, actionId: current.actionId || firstAction }));
  }

  async function uploadQdd(file: File) {
    setIsPreviewingImport(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('periodType', selectedPeriodType);
      formData.set('referenceMonth', String(selectedReferenceMonth));
      const result = await api<ImportPreview>('/imports/qdd/preview', {
        method: 'POST',
        body: formData,
      });
      setPreview(result);
      toast.success('Prévia do QDD gerada com sucesso.');
      setActiveSection('structure');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar a prévia do QDD.');
    } finally {
      setIsPreviewingImport(false);
    }
  }

  async function confirmImport() {
    if (!preview || isConfirmingImport) return;
    setIsConfirmingImport(true);
    try {
      await api('/imports/qdd/confirm', {
        method: 'POST',
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      setPreview(null);
      toast.success('QDD importado e registrado como vigente.');
      setActionsFilters(initialActionsFilters);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar a importação do QDD.');
    } finally {
      setIsConfirmingImport(false);
    }
  }

  async function deleteImport(importRecord: BudgetImport) {
    if (deletingImportId) return;
    const confirmed = window.confirm(
      `Excluir a importação ${formatPeriod(importRecord.referenceMonth, importRecord.year, importRecord.periodType)}?\n\n` +
      'As ações, linhas de despesa, classificações e validações vinculadas a este QDD serão removidas.',
    );
    if (!confirmed) return;

    setDeletingImportId(importRecord.id);
    try {
      await api(`/imports/qdd/${importRecord.id}`, { method: 'DELETE' });
      toast.success('Importação excluída.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir a importação.');
    } finally {
      setDeletingImportId('');
    }
  }

  async function createAssignment() {
    if (!selectedActionId) return;
    const snapshot = actions;
    try {
      const created = await api<ThematicAssignment>('/thematic-assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...assignment,
          actionId: selectedActionId,
          weightingFactor: resolveWeightingFactor(
            assignment.theme,
            assignment.classification,
            assignment.weightingFactor ? Number(assignment.weightingFactor) : undefined,
          ),
        }),
      });
      toast.success('Ação classificada no orçamento temático.');
      setActions((current) => appendActionAssignment(current, selectedActionId, created));
      setSummary((current) => incrementSummaryAssignments(current, 1));
      try {
        const fresh = await fetchCurationSnapshot();
        setActions(fresh.actions);
        setSummary(fresh.summary);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao classificar ação.');
    }
  }

  async function confirmRemoveAssignment() {
    const action = actions.find((a) => a.id === selectedActionId);
    if (!selectedActionId || isRemovingAssignment || !action) return;
    const validIds = new Set(action.assignments.map((a) => a.id));
    const idsToRemove = assignmentIdsPendingRemoval.filter((id) => validIds.has(id));
    if (idsToRemove.length === 0) {
      toast.warning('Marque ao menos uma classificação para remover.');
      return;
    }

    const snapshot = actions;
    const actionId = selectedActionId;
    setIsRemovingAssignment(true);

    try {
      const results = await Promise.allSettled(
        idsToRemove.map((id) => api(`/thematic-assignments/${id}`, { method: 'DELETE' })),
      );

      const succeeded: string[] = [];
      let firstError: string | null = null;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          succeeded.push(idsToRemove[index]!);
        } else if (!firstError) {
          firstError =
            result.reason instanceof Error ? result.reason.message : 'Erro ao remover a classificação.';
        }
      });

      if (succeeded.length > 0) {
        setActions((prev) => patchActionAssignments(prev, actionId, succeeded));
        setSummary((prev) => decrementSummaryAssignments(prev, succeeded.length));
      } else {
        setActions(snapshot);
      }

      if (firstError) {
        toast.error(firstError);
        if (succeeded.length > 0) {
          toast.warning(`${succeeded.length} classificação(ões) removida(s) antes do erro.`);
        }
      } else {
        toast.success(
          succeeded.length === 1 ? 'Classificação removida.' : `${succeeded.length} classificações removidas.`,
        );
        setRemovePopoverOpen(false);
        setAssignmentIdsPendingRemoval([]);
      }

      try {
        const fresh = await fetchCurationSnapshot();
        setActions(fresh.actions);
        setSummary(fresh.summary);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao remover classificações.');
    } finally {
      setIsRemovingAssignment(false);
    }
  }

  async function reviewValidation(id: string, decision: 'approve' | 'return') {
    await api(`/validations/${id}/${decision}`, {
      method: 'POST',
      body: JSON.stringify({
        reviewerComment: decision === 'approve' ? 'Aprovado pela SEPLAN.' : 'Devolvido para ajustes.',
      }),
    });
    toast.success(decision === 'approve' ? 'Validação aprovada.' : 'Validação devolvida.');
    await load();
  }

  async function revertApproval(id: string) {
    await api(`/validations/${id}/revert`, { method: 'POST' });
    toast.success('Aprovação revertida. Validação voltou para análise.');
    await load();
  }

  const columns = useMemo<ColumnDef<BudgetAction>[]>(
    () => [
      {
        accessorKey: 'organizationCode',
        header: 'Órgão',
        cell: ({ row }) => (
          <div className="flex min-w-56 flex-col gap-1">
            <div className="font-medium">{row.original.organizationCode} - {row.original.organizationName}</div>
            <div className="text-xs text-muted-foreground">{row.original.unitCode} - {row.original.unitName}</div>
          </div>
        ),
      },
      {
        accessorKey: 'application',
        header: 'Ação consolidada',
        cell: ({ row }) => (
          <button
            className="max-w-xl text-left text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setSelectedActionId(row.original.id);
              setAssignment((current) => ({ ...current, actionId: row.original.id }));
              setActiveSection('curation');
            }}
          >
            {row.original.projectActivity} - {row.original.application}
          </button>
        ),
      },
      {
        accessorKey: 'totals.initialBudget',
        header: 'Inicial planejado',
        cell: ({ row }) => formatMoney(row.original.totals.initialBudget),
      },
      {
        accessorKey: 'totals.liquidated',
        header: 'Liquidado',
        cell: ({ row }) => formatMoney(row.original.totals.liquidated),
      },
      {
        accessorKey: 'assignments',
        header: 'Temas',
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue || filterValue === allValue) return true;
          return row.original.assignments.some((a: ThematicAssignment) => a.theme === filterValue);
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.assignments.length ? (
              row.original.assignments.map((item) => <ThemeBadge key={item.id} theme={item.theme} />)
            ) : (
              <Badge variant="secondary">Sem tema</Badge>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const tableColumnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];

    if (columnFilters.organizationCode !== allValue) {
      filters.push({ id: 'organizationCode', value: columnFilters.organizationCode });
    }

    if (columnFilters.application) {
      filters.push({ id: 'application', value: columnFilters.application });
    }

    if (columnFilters.theme !== allValue) {
      filters.push({ id: 'assignments', value: columnFilters.theme });
    }

    return filters;
  }, [columnFilters.application, columnFilters.organizationCode, columnFilters.theme]);

  const handleColumnFiltersChange = useCallback((nextFilters: ActionColumnFilters) => {
    setColumnFilters((currentFilters) => {
      if (
        currentFilters.organizationCode === nextFilters.organizationCode &&
        currentFilters.application === nextFilters.application &&
        currentFilters.theme === nextFilters.theme
      ) {
        return currentFilters;
      }

      return nextFilters;
    });
  }, []);

  const openStructureSection = useCallback(() => {
    setQddPopoverOpen(false);
    setActiveSection('structure');
  }, []);

  const table = useReactTable({
    data: actions,
    columns,
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
    state: {
      globalFilter: filter,
      columnFilters: tableColumnFilters,
    },
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      if (!search) return true;
      const original = row.original;
      return (
        original.organizationCode.toLowerCase().includes(search) ||
        original.organizationName.toLowerCase().includes(search) ||
        original.application.toLowerCase().includes(search) ||
        original.projectActivity.toLowerCase().includes(search)
      );
    },
  });

  const organizations = useMemo(() => {
    return uniqueBy(actions, (action) => action.organizationCode)
      .map((action) => ({ code: action.organizationCode, name: action.organizationName }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [actions]);

  const organizationUnitCounts = useMemo(() => {
    const unitsByOrganization = new Map<string, Set<string>>();

    for (const action of actions) {
      const units = unitsByOrganization.get(action.organizationCode) ?? new Set<string>();
      units.add(action.unitCode);
      unitsByOrganization.set(action.organizationCode, units);
    }

    return unitsByOrganization;
  }, [actions]);

  const organizationUnits = useMemo(() => {
    const map = new Map<string, { code: string; name: string }[]>();
    for (const action of actions) {
      if (!map.has(action.organizationCode)) map.set(action.organizationCode, []);
      const list = map.get(action.organizationCode)!;
      if (!list.some((u) => u.code === action.unitCode)) {
        list.push({ code: action.unitCode, name: action.unitName });
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.code.localeCompare(b.code));
    return map;
  }, [actions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeSection !== 'structure' || structureTab !== 'management') return;

    const element = managementCardsRef.current;
    if (!element) return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    let frameId = 0;

    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (!mediaQuery.matches) {
          setManagementCardsHeight(null);
          return;
        }

        setManagementCardsHeight(Math.ceil(element.getBoundingClientRect().height));
      });
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    mediaQuery.addEventListener('change', updateHeight);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      mediaQuery.removeEventListener('change', updateHeight);
    };
  }, [activeSection, structureTab, preview, actions.length, organizations.length]);

  const units = useMemo(() => {
    return uniqueBy(
      actions.filter((action) => actionsFilters.organizationCode === allValue || action.organizationCode === actionsFilters.organizationCode),
      (action) => `${action.organizationCode}-${action.unitCode}`,
    )
      .map((action) => ({ code: action.unitCode, name: action.unitName, organizationCode: action.organizationCode }))
      .sort((a, b) => `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`));
  }, [actions, actionsFilters.organizationCode]);

  const years = useMemo(() => [...new Set(actions.map((action) => String(action.year)))].sort(), [actions]);

  const filteredStructureActions = useMemo(() => {
    return actions.filter((action) => {
      if (actionsFilters.organizationCode !== allValue && action.organizationCode !== actionsFilters.organizationCode) return false;
      if (actionsFilters.unitCode !== allValue && action.unitCode !== actionsFilters.unitCode) return false;
      return true;
    });
  }, [actions, actionsFilters]);

  const displayedStructureActions = useMemo(() => {
    const q = actionsSearch.trim().toLowerCase();
    if (!q) return filteredStructureActions;
    return filteredStructureActions.filter(
      (a) =>
        a.application.toLowerCase().includes(q) ||
        a.functionalProgram.toLowerCase().includes(q) ||
        a.projectActivity.toLowerCase().includes(q)
    );
  }, [filteredStructureActions, actionsSearch]);

  const structureActionsShowUnit = actionsFilters.unitCode === allValue;

  const selectedStructureOrganization = useMemo(() => {
    if (actionsFilters.organizationCode === allValue) return null;
    return organizations.find((o) => o.code === actionsFilters.organizationCode) ?? null;
  }, [actionsFilters.organizationCode, organizations]);

  const structureSelectedUnitLabel = useMemo(() => {
    if (actionsFilters.unitCode === allValue) return null;
    const u =
      actionsFilters.organizationCode === allValue
        ? units.find((x) => x.code === actionsFilters.unitCode)
        : units.find(
            (x) =>
              x.code === actionsFilters.unitCode &&
              x.organizationCode === actionsFilters.organizationCode
          );
    return u ? `${u.code} — ${u.name}` : actionsFilters.unitCode;
  }, [units, actionsFilters.unitCode, actionsFilters.organizationCode]);

  const structureActionsScopeDescription = useMemo(() => {
    const count = displayedStructureActions.length.toLocaleString('pt-BR');
    if (actionsFilters.organizationCode === allValue) {
      const unitPart = structureSelectedUnitLabel ? ` · ${structureSelectedUnitLabel}` : '';
      return `${count} ação(ões) · todas as secretarias${unitPart}`;
    }
    const unitPart = structureActionsShowUnit
      ? 'Todas as unidades da secretaria'
      : structureSelectedUnitLabel ?? '—';
    return `${count} ação(ões) na lista atual · ${unitPart}`;
  }, [
    displayedStructureActions.length,
    actionsFilters.organizationCode,
    structureSelectedUnitLabel,
    structureActionsShowUnit,
  ]);

  const themeGaugeData = useMemo(() => {
    const acc = new Map<ThemeBudget, { liquidated: number; planned: number }>();
    for (const action of actions) {
      const seen = new Set<ThemeBudget>();
      for (const asgn of action.assignments) {
        if (seen.has(asgn.theme)) continue;
        seen.add(asgn.theme);
        const entry = acc.get(asgn.theme) ?? { liquidated: 0, planned: 0 };
        entry.liquidated += action.totals.liquidated;
        entry.planned += action.totals.updatedBudget;
        acc.set(asgn.theme, entry);
      }
    }
    const themes: { key: ThemeBudget; label: string }[] = [
      { key: 'OSG', label: 'Orçamento Sensível ao Gênero' },
      { key: 'OCAD', label: 'Orçamento Criança e Adolescente' },
      { key: 'CLIMATICO', label: 'Orçamento do Clima' },
    ];
    return themes.map(({ key, label }) => {
      const { liquidated = 0, planned = 0 } = acc.get(key) ?? {};
      const pct = planned > 0 ? Math.min((liquidated / planned) * 100, 100) : 0;
      return { key, label, liquidated, planned, pct };
    });
  }, [actions]);

  const axisReport = useMemo(
    () => buildAxisExecutionReport(actions, metadata),
    [actions, metadata],
  );

  const classificationReport = useMemo(
    () => buildClassificationExecutionReport(actions, metadata),
    [actions, metadata],
  );

  const trackingByYear = useMemo(() => {
    const byYear = new Map<
      number,
      {
        year: number;
        total: number;
        byStatus: Record<string, number>;
        orgs: Map<string, { code: string; name: string; total: number; sent: number }>;
      }
    >();
    for (const v of validations) {
      const year = v.cycle?.year ?? v.action?.year ?? 0;
      let entry = byYear.get(year);
      if (!entry) {
        entry = { year, total: 0, byStatus: { RASCUNHO: 0, ENVIADO: 0, DEVOLVIDO: 0, APROVADO: 0 }, orgs: new Map() };
        byYear.set(year, entry);
      }
      entry.total += 1;
      entry.byStatus[v.status] = (entry.byStatus[v.status] ?? 0) + 1;
      const code = v.organizationCode || v.action?.organizationCode || '—';
      let org = entry.orgs.get(code);
      if (!org) {
        org = { code, name: v.action?.organizationName ?? code, total: 0, sent: 0 };
        entry.orgs.set(code, org);
      }
      org.total += 1;
      if (v.status === 'ENVIADO' || v.status === 'APROVADO') org.sent += 1;
    }
    return [...byYear.values()]
      .map((e) => ({ ...e, orgs: [...e.orgs.values()].sort((a, b) => a.code.localeCompare(b.code)) }))
      .sort((a, b) => b.year - a.year);
  }, [validations]);

  const reviewByOrg = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; items: ValidationItem[]; byStatus: Record<string, number> }
    >();
    for (const v of validations) {
      const code = v.organizationCode || v.action?.organizationCode || '—';
      let entry = map.get(code);
      if (!entry) {
        entry = { code, name: v.action?.organizationName ?? code, items: [], byStatus: { RASCUNHO: 0, ENVIADO: 0, DEVOLVIDO: 0, APROVADO: 0 } };
        map.set(code, entry);
      }
      entry.items.push(v);
      entry.byStatus[v.status] = (entry.byStatus[v.status] ?? 0) + 1;
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [validations]);

  const approvedValidations = useMemo(
    () => validations.filter((v) => v.status === 'APROVADO'),
    [validations],
  );

  const resultsByTheme = useMemo<
    (ResultsThemeSummary & { items: ValidationItem[] })[]
  >(() => {
    const themes: ThemeBudget[] = ['OSG', 'OCAD', 'CLIMATICO'];
    return themes.map((theme) => {
      const items = approvedValidations.filter((v) => v.theme === theme);
      const actions = new Set<string>();
      const orgs = new Set<string>();
      let executed = 0;
      let liquidated = 0;
      let deliveriesCount = 0;
      for (const v of items) {
        actions.add(v.actionId);
        orgs.add(v.organizationCode || v.action?.organizationCode || '');
        executed += v.informedExecutedValue ?? 0;
        liquidated += v.action?.totals?.liquidated ?? 0;
        deliveriesCount += v.deliveries?.length ?? 0;
      }
      return {
        theme,
        label: themeLabels[theme] ?? theme,
        items,
        actionCount: actions.size,
        orgCount: orgs.size,
        executed,
        liquidated,
        deliveriesCount,
      };
    });
  }, [approvedValidations]);

  function handleExportXlsx() {
    try {
      exportResultsXlsx(approvedValidations, defaultExportFilename('xlsx'));
      toast.success('Relatório XLSX exportado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar XLSX.');
    }
  }

  function handleExportCsv() {
    try {
      const rows = buildResultsRows(approvedValidations);
      exportResultsCsv(rows, defaultExportFilename('csv'));
      toast.success('Relatório CSV exportado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar CSV.');
    }
  }

  const currentTheme = assignment.theme;
  const axes = metadata?.axes[currentTheme] ?? [];
  const classifications = metadata?.classifications[currentTheme] ?? [];
  const selectedAction = actions.find((action) => action.id === selectedActionId);
  const existingAssignment =
    selectedAction?.assignments.find((item) => item.theme === assignment.theme) ?? null;
  const selectedActionHasTheme = Boolean(existingAssignment);
  const assignmentsRemovalKey = selectedAction?.assignments.map((a) => a.id).join() ?? '';

  useEffect(() => {
    const list = selectedAction?.assignments ?? [];
    const ids = new Set(list.map((a) => a.id));
    setAssignmentIdsPendingRemoval((current) => current.filter((id) => ids.has(id)));
  }, [selectedAction?.id, assignmentsRemovalKey]);

  useEffect(() => {
    if (!removePopoverOpen) {
      setAssignmentIdsPendingRemoval([]);
      return;
    }
    const list = selectedAction?.assignments ?? [];
    setAssignmentIdsPendingRemoval(list.map((item) => item.id));
  }, [removePopoverOpen, selectedAction?.id, assignmentsRemovalKey]);

  useEffect(() => {
    setRemovePopoverOpen(false);
  }, [selectedActionId]);

  const filteredActionCount = table.getFilteredRowModel().rows.length;
  const organizationCount = organizations.length;
  const unitCount = uniqueBy(actions, (action) => `${action.organizationCode}-${action.unitCode}`).length;
  const expenseLineCount = actions.reduce((total, action) => total + (action.expenseLinesCount ?? action.expenseLines?.length ?? 0), 0);

  const navItems: {
    id: SectionId;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Visão geral', icon: GaugeIcon },
    { id: 'structure', label: 'Estrutura vigente', icon: DatabaseIcon, badge: actions.length },
    { id: 'curation', label: 'Curadoria temática', icon: FolderCogIcon, badge: summary?.assignments ?? 0 },
    { id: 'cycles', label: 'Acompanhamento', icon: SendIcon, badge: validations.filter((v) => v.status === 'ENVIADO').length },
    { id: 'review', label: 'Revisão', icon: ClipboardCheckIcon, badge: validations.length },
    { id: 'results', label: 'Resultados', icon: FileBarChart2Icon, badge: approvedValidations.length },
    { id: 'reports', label: 'Informações Gerais', icon: BarChart3Icon },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="bg-sidebar-primary text-sidebar-primary-foreground p-0">
          <div className="flex h-16 items-center justify-center px-4">
            <span className="truncate text-lg font-semibold leading-tight">
              Perfil de Administrador
            </span>
          </div>
        </SidebarHeader>
        <div className="mx-3 h-px shrink-0 bg-sidebar-border" aria-hidden="true" />
        <SidebarContent className="[--sidebar:oklch(0.97_0.005_165)] [--sidebar-foreground:oklch(0.25_0.04_165)] [--sidebar-accent:oklch(0.90_0.02_165)] [--sidebar-accent-foreground:oklch(0.18_0.05_165)] [--sidebar-border:oklch(0.85_0.03_165)]">
          <SidebarGroup>
            <SidebarGroupLabel>Painel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[navItems[0], navItems[6]].map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        onClick={() => setActiveSection(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {typeof item.badge === 'number' && item.badge > 0 ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Dados e curadoria</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[navItems[1], navItems[2]].map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        onClick={() => setActiveSection(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {typeof item.badge === 'number' && item.badge > 0 ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Validação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[navItems[3], navItems[4], navItems[5]].map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        onClick={() => setActiveSection(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {typeof item.badge === 'number' && item.badge > 0 ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <div className="mx-3 h-px shrink-0 bg-sidebar-border" aria-hidden="true" />
        <SidebarFooter className="[--sidebar:oklch(0.97_0.005_165)] [--sidebar-foreground:oklch(0.25_0.04_165)] [--sidebar-accent:oklch(0.90_0.02_165)] [--sidebar-accent-foreground:oklch(0.18_0.05_165)] [--sidebar-border:oklch(0.85_0.03_165)]">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Atualizar" onClick={() => void load()}>
                <RefreshCwIcon />
                <span>Atualizar dados</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sair"
                disabled={isSigningOut}
                onClick={signOut}
              >
                {isSigningOut ? <RefreshCwIcon className="animate-spin" /> : <LogOutIcon />}
                <span>{isSigningOut ? 'Saindo...' : 'Sair'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 shrink-0 border-b border-primary-foreground/20 bg-primary text-primary-foreground shadow-sm">
          <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6 2xl:px-8">
            <div className="flex items-center gap-3">
              <SidebarTrigger size="icon-lg" className="size-10 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground [&_svg]:size-8" />
              <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
              <span className="text-xl font-semibold uppercase tracking-widest text-primary-foreground/50 select-none">|</span>
              <span className="font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>Orçamentos Temáticos</span>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">
                    <BookOpenIcon data-icon="inline-start" />
                    Legislação
                    <ChevronDownIcon className="ml-1 size-4 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-72 p-2">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Orçamentos Temáticos</p>
                  {LEGISLATION_LINKS.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span>{item.label}</span>
                      <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </PopoverContent>
              </Popover>
              <Button variant="secondary" onClick={() => void load()}>
                <RefreshCwIcon data-icon="inline-start" />
                Atualizar
              </Button>
              <Button
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                variant="ghost"
                disabled={isSigningOut}
                onClick={signOut}
              >
                {isSigningOut ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <LogOutIcon data-icon="inline-start" />}
                {isSigningOut ? 'Saindo...' : 'Sair'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 overflow-hidden px-4 py-5 lg:px-6 2xl:px-8">
          {activeSection === 'overview' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <ActionsTableCard
                title="Ações orçamentárias consolidadas"
                description={`${filteredActionCount} registros filtrados`}
                table={table}
                organizations={organizations}
                themeSummary={summary?.totalsByTheme ?? []}
                qddStats={{ organizationCount, unitCount, expenseLineCount, actionCount: actions.length }}
                onOpenStructure={openStructureSection}
                columnFilters={columnFilters}
                onColumnFiltersChange={handleColumnFiltersChange}
                themePopoverOpen={themePopoverOpen}
                onThemePopoverOpenChange={setThemePopoverOpen}
                qddPopoverOpen={qddPopoverOpen}
                onQddPopoverOpenChange={setQddPopoverOpen}
              />
            </div>
          ) : null}

          {activeSection === 'structure' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5">
              <Tabs
                value={structureTab}
                onValueChange={(v) => setStructureTab(v as 'management' | 'actions')}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                <TabsList className="w-fit shrink-0">
                  <TabsTrigger value="management">Gerenciamento</TabsTrigger>
                  <TabsTrigger value="actions">Dados de Orçamento</TabsTrigger>
                </TabsList>

                <TabsContent value="management" className="mt-0 min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start">
                    <div ref={managementCardsRef} className="flex min-h-0 flex-col gap-5">
                      {/* Importar QDD */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Importar QDD</CardTitle>
                          <CardDescription>Substitua a base vigente apenas quando houver uma nova versão oficial.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <FieldGroup>
                            <Field>
                              <FieldLabel>Tipo de período</FieldLabel>
                              <Select value={selectedPeriodType} onValueChange={(v) => setSelectedPeriodType(v as QddPeriodType)}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="ACUMULADO_ANUAL">Acumulado anual (jan a X)</SelectItem>
                                    <SelectItem value="MES_ISOLADO">Mês isolado</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                            {selectedPeriodType === 'MES_ISOLADO' && (
                              <Field>
                                <FieldLabel>Mês de referência</FieldLabel>
                                <Select value={String(selectedReferenceMonth)} onValueChange={(v) => setSelectedReferenceMonth(Number(v))}>
                                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {MONTH_NAMES.map((name, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                          </FieldGroup>
                          <Button
                            asChild
                            variant="outline"
                            aria-disabled={isPreviewingImport || isConfirmingImport}
                            className={cn(
                              'h-20 w-full cursor-pointer border-dashed bg-primary/5 text-primary',
                              (isPreviewingImport || isConfirmingImport) && 'pointer-events-none opacity-60',
                            )}
                          >
                            <label>
                              {isPreviewingImport ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <UploadIcon data-icon="inline-start" />}
                              {isPreviewingImport ? 'Processando QDD...' : 'Selecionar .xls ou .xlsx'}
                              <input
                                type="file"
                                accept=".xls,.xlsx"
                                className="hidden"
                                disabled={isPreviewingImport || isConfirmingImport}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void uploadQdd(file);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                          </Button>
                          {preview ? (
                            <Alert className="relative border-primary/25 bg-primary/5">
                              <FileSpreadsheetIcon />
                              <AlertDescription>
                                <span className="block font-medium text-foreground">{preview.filename}</span>
                                <span className="block">Período: {formatPeriod(preview.referenceMonth, preview.year, preview.periodType)}</span>
                                <span className="block">{preview.rowCount} linhas · {preview.actionCount} ações · {preview.organizationsCount} órgãos</span>
                              </AlertDescription>
                              <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Remover arquivo"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </Alert>
                          ) : null}
                          {preview ? (
                            <Button disabled={isConfirmingImport || isPreviewingImport} onClick={() => void confirmImport()}>
                              {isConfirmingImport ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <CheckCircle2Icon data-icon="inline-start" />}
                              {isConfirmingImport ? 'Registrando QDD...' : 'Confirmar e registrar QDD'}
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>

                      {/* Estatísticas da base */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Base vigente</CardTitle>
                          <CardDescription>Cobertura administrativa e programática do QDD carregado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Órgãos', value: organizationCount },
                              { label: 'Unidades', value: unitCount },
                              { label: 'Ações', value: actions.length },
                              { label: 'Linhas QDD', value: expenseLineCount },
                            ].map((s) => (
                              <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="text-2xl font-semibold">{s.value.toLocaleString('pt-BR')}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card
                      className="lg:min-h-0"
                      style={managementCardsHeight ? { height: `${managementCardsHeight}px` } : undefined}
                    >
                      <CardHeader>
                        <CardTitle>Secretarias na estrutura</CardTitle>
                        <CardDescription>
                          {organizations.length} secretaria{organizations.length !== 1 ? 's' : ''} na base vigente.
                        </CardDescription>
                        {organizations.length > 0 && (
                          <CardAction>
                            <div className="relative">
                              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Buscar secretaria..."
                                value={orgSearch}
                                onChange={(e) => setOrgSearch(e.target.value)}
                                className="w-48 pl-9"
                              />
                            </div>
                          </CardAction>
                        )}
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                        {organizations.length === 0 ? (
                          <Empty>
                            <EmptyHeader><EmptyMedia><DatabaseIcon /></EmptyMedia></EmptyHeader>
                            <EmptyTitle>Nenhuma secretaria na base</EmptyTitle>
                            <EmptyDescription>Importe um QDD acima para listar as secretarias da estrutura vigente.</EmptyDescription>
                          </Empty>
                        ) : (
                          <div className="min-h-0 flex-1">
                            <ScrollArea className="h-full w-full">
                              <div className="flex flex-col gap-2 pr-4">
                                {organizations
                                  .filter((org) => {
                                    const q = orgSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    if (org.code.toLowerCase().includes(q) || org.name.toLowerCase().includes(q)) return true;
                                    return (organizationUnits.get(org.code) ?? []).some(
                                      (u) => u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
                                    );
                                  })
                                  .map((organization) => {
                                    const unitCount = organizationUnitCounts.get(organization.code)?.size ?? 0;
                                    const allUnits = organizationUnits.get(organization.code) ?? [];

                                    return (
                                      <div key={organization.code} className="rounded-lg border">
                                        <button
                                          type="button"
                                          onClick={() => toggleOrg(organization.code)}
                                          className="flex w-full items-center justify-between gap-3 p-3 text-left"
                                        >
                                          <div className="min-w-0">
                                            <p className="font-medium leading-snug">{organization.code} - {organization.name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                              {unitCount} unidade{unitCount !== 1 ? 's' : ''} vinculada{unitCount !== 1 ? 's' : ''}
                                            </p>
                                          </div>
                                          <ChevronDownIcon
                                            className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', expandedOrgs.has(organization.code) && 'rotate-180 text-primary')}
                                          />
                                        </button>
                                        {expandedOrgs.has(organization.code) && (
                                          <div className="border-t px-3 pb-3 pt-2">
                                            <div className="flex flex-col gap-1.5">
                                              {allUnits.map((unit) => (
                                                <button
                                                  key={unit.code}
                                                  type="button"
                                                  onClick={() => {
                                                    setActionsFilters({ organizationCode: organization.code, unitCode: unit.code });
                                                    setStructureTab('actions');
                                                  }}
                                                  className="group flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 text-left"
                                                >
                                                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{unit.code}</span>
                                                  <span className="truncate text-xs">{unit.name}</span>
                                                  <ExternalLinkIcon className="ml-auto shrink-0 size-3 text-muted-foreground/60 group-hover:text-primary" />
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Histórico de importações */}
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Histórico de importações</CardTitle>
                      <CardDescription>{importHistory.length} QDD{importHistory.length !== 1 ? 's' : ''} registrado{importHistory.length !== 1 ? 's' : ''}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {importHistory.length === 0 ? (
                        <Empty>
                          <EmptyHeader><EmptyMedia><FileSpreadsheetIcon /></EmptyMedia></EmptyHeader>
                          <EmptyTitle>Nenhum QDD registrado</EmptyTitle>
                          <EmptyDescription>Importe o primeiro arquivo acima.</EmptyDescription>
                        </Empty>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {importHistory.map((imp) => (
                            <div key={imp.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                              <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={imp.status === 'VIGENTE' ? 'default' : 'secondary'} className="shrink-0">
                                    {imp.status === 'VIGENTE' ? 'Vigente' : 'Histórico'}
                                  </Badge>
                                  <span className="font-medium">{formatPeriod(imp.referenceMonth, imp.year, imp.periodType)}</span>
                                  <span className="text-xs text-muted-foreground">{imp.periodType === 'ACUMULADO_ANUAL' ? 'Acumulado' : 'Mês isolado'}</span>
                                </div>
                                <span className="truncate text-xs text-muted-foreground" title={imp.filename}>{imp.filename}</span>
                                <span className="text-xs text-muted-foreground">
                                  {imp.actionCount.toLocaleString('pt-BR')} ações · {imp.rowCount.toLocaleString('pt-BR')} linhas · {new Date(imp.importedAt).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingImportId === imp.id}
                                title="Excluir importação"
                                aria-label="Excluir importação"
                                onClick={() => void deleteImport(imp)}
                              >
                                {deletingImportId === imp.id ? (
                                  <RefreshCwIcon className="size-4 animate-spin" />
                                ) : (
                                  <Trash2Icon className="size-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="actions" className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col">
                    <Card className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <CardHeader className="shrink-0">
                        <CardTitle>
                          {actionsFilters.organizationCode === allValue
                            ? 'Ações programadas'
                            : selectedStructureOrganization
                              ? `${selectedStructureOrganization.code} — ${selectedStructureOrganization.name}`
                              : 'Ações programadas'}
                        </CardTitle>
                        <CardDescription>
                          <span className="block">{structureActionsScopeDescription}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
                        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                          <OrgaoCombobox
                            value={actionsFilters.organizationCode}
                            organizations={organizations}
                            onChange={(value) => {
                              setActionsFilters({ organizationCode: value, unitCode: allValue });
                              setActionsSearch('');
                            }}
                            className="relative w-full min-w-0"
                          />
                          <Select
                            value={actionsFilters.unitCode}
                            onValueChange={(value) => setActionsFilters({ ...actionsFilters, unitCode: value })}
                          >
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue placeholder="Todas as unidades" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={allValue}>Todas as unidades</SelectItem>
                                {units.map((unit) => (
                                  <SelectItem key={`${unit.organizationCode}-${unit.code}`} value={unit.code}>
                                    {unit.code} - {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <div className="relative min-w-0">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Buscar ação, programa funcional..."
                              value={actionsSearch}
                              onChange={(e) => setActionsSearch(e.target.value)}
                              className="w-full min-w-0 pl-9"
                            />
                          </div>
                        </div>
                        <div className="grid min-w-0 shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
                          {[
                            {
                              label: 'Ações',
                              value: filteredStructureActions.length.toLocaleString('pt-BR'),
                            },
                            {
                              label: 'Planejado inicial',
                              value: formatMoney(
                                filteredStructureActions.reduce((s, a) => s + a.totals.initialBudget, 0)
                              ),
                            },
                            {
                              label: 'Orçamento atualizado',
                              value: formatMoney(
                                filteredStructureActions.reduce((s, a) => s + a.totals.updatedBudget, 0)
                              ),
                            },
                            {
                              label: 'Liquidado',
                              value: formatMoney(
                                filteredStructureActions.reduce((s, a) => s + a.totals.liquidated, 0)
                              ),
                            },
                            {
                              label: 'Disponível',
                              value: formatMoney(
                                filteredStructureActions.reduce((s, a) => s + a.totals.available, 0)
                              ),
                            },
                          ].map((stat) => (
                            <div key={stat.label} className="min-w-0 rounded-lg border bg-muted/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                        {displayedStructureActions.length === 0 ? (
                          <Empty>
                            <EmptyHeader><EmptyMedia><DatabaseIcon /></EmptyMedia></EmptyHeader>
                            <EmptyTitle>Nenhuma ação encontrada</EmptyTitle>
                            <EmptyDescription>Não há ações programadas para a seleção atual.</EmptyDescription>
                          </Empty>
                        ) : (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <Separator className="shrink-0" />
                            <ScrollArea className="min-h-0 min-w-0 flex-1 w-full">
                              <div className="min-w-0">
                                <Table className="table-fixed w-full min-w-[42rem]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="h-9 w-[38%] min-w-[12rem] text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Ação
                                  </TableHead>
                                  {structureActionsShowUnit ? (
                                    <TableHead className="h-9 w-[18%] max-w-[10rem] text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                      Unidade
                                    </TableHead>
                                  ) : null}
                                  <TableHead className="h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Inicial
                                  </TableHead>
                                  <TableHead className="h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Atualizado
                                  </TableHead>
                                  <TableHead className="h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Liquidado
                                  </TableHead>
                                  <TableHead className="h-9 w-[7.5rem] text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Disponível
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {displayedStructureActions.map((action) => (
                                  <TableRow key={action.id}>
                                    <TableCell className="w-[38%] min-w-[12rem] whitespace-normal break-words py-2 align-top">
                                      <div className="flex min-w-0 flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                                            {action.projectActivity}
                                          </Badge>
                                        </div>
                                        <p className="text-sm font-medium leading-snug">{action.application}</p>
                                        <p className="text-xs text-muted-foreground">{action.functionalProgram}</p>
                                      </div>
                                    </TableCell>
                                    {structureActionsShowUnit ? (
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
                                      {formatMoney(action.totals.available)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                </TabsContent>
              </Tabs>
            </section>
          ) : null}

          {activeSection === 'curation' ? (
            <section className="grid min-h-0 flex-1 gap-5 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_430px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
              <ActionsTableCard
                title="Selecionar ação para curadoria"
                description={`${filteredActionCount} registros filtrados`}
                table={table}
                organizations={organizations}
                themeSummary={summary?.totalsByTheme ?? []}
                qddStats={{ organizationCount, unitCount, expenseLineCount, actionCount: actions.length }}
                onOpenStructure={openStructureSection}
                columnFilters={columnFilters}
                onColumnFiltersChange={handleColumnFiltersChange}
                themePopoverOpen={themePopoverOpen}
                onThemePopoverOpenChange={setThemePopoverOpen}
                qddPopoverOpen={qddPopoverOpen}
                onQddPopoverOpenChange={setQddPopoverOpen}
              />

              <Card >
                <CardHeader>
                  <CardTitle>Curadoria temática</CardTitle>
                  <CardDescription>
                    {selectedAction ? `${selectedAction.projectActivity} - ${selectedAction.application}` : 'Selecione uma ação consolidada.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Tema</FieldLabel>
                      <Select value={assignment.theme} onValueChange={(value) => setAssignment({ ...assignment, theme: value as ThemeBudget, axis: '', classification: '', weightingFactor: '' })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {metadata?.themes.map((theme) => (
                              <SelectItem key={theme} value={theme}>{themeLabels[theme]}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Eixo</FieldLabel>
                      <Select value={assignment.axis || 'UNSELECTED'} onValueChange={(value) => setAssignment({ ...assignment, axis: value === 'UNSELECTED' ? '' : value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="UNSELECTED">Selecione</SelectItem>
                            {axes.map((axis) => <SelectItem key={axis.value} value={axis.value}>{axis.label}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Classificação</FieldLabel>
                      <Select
                        value={assignment.classification || 'UNSELECTED'}
                        onValueChange={(value) => {
                          const classification = value === 'UNSELECTED' ? '' : value;
                          setAssignment({
                            ...assignment,
                            classification,
                            weightingFactor: weightingFactorFormValue(assignment.theme, classification, ''),
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="UNSELECTED">Selecione</SelectItem>
                            {classifications.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
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
                          isWeightingFactorLocked(assignment.theme, assignment.classification) || undefined
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
                          disabled={isWeightingFactorLocked(assignment.theme, assignment.classification)}
                          onChange={(event) => setAssignment({ ...assignment, weightingFactor: event.target.value })}
                          placeholder="Opcional"
                        />
                        {lockedWeightingFactorLabel(assignment.theme, assignment.classification) ? (
                          <FieldDescription>
                            {lockedWeightingFactorLabel(assignment.theme, assignment.classification)}
                          </FieldDescription>
                        ) : null}
                      </Field>
                    )}
                    <Field>
                      <FieldLabel htmlFor="justification">Justificativa <span className="text-muted-foreground font-normal">(opcional)</span></FieldLabel>
                      <Textarea id="justification" value={assignment.justification} onChange={(event) => setAssignment({ ...assignment, justification: event.target.value })} />
                    </Field>
                    {selectedActionHasTheme ? (
                      <Alert className="border-primary/25 bg-primary/5">
                        <FolderCogIcon />
                        <AlertDescription className="text-xs">
                          Esta ação já possui classificação para <strong>{themeLabels[assignment.theme]}</strong>. Use &quot;Remover classificação&quot; para excluí-la quando não houver validações vinculadas — assim você poderá classificar novamente neste tema.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={
                          !selectedActionId ||
                          !assignment.axis ||
                          !assignment.classification ||
                          selectedActionHasTheme ||
                          isRemovingAssignment
                        }
                        onClick={() => void createAssignment()}
                      >
                        <FolderCogIcon data-icon="inline-start" />
                        Classificar ação
                      </Button>
                      {(selectedAction?.assignments.length ?? 0) > 0 && selectedActionId ? (
                        <RemoveClassificationPopover
                          open={removePopoverOpen}
                          onOpenChange={setRemovePopoverOpen}
                          metadata={metadata}
                          selectedAction={selectedAction ?? null}
                          selectedAssignmentIds={assignmentIdsPendingRemoval}
                          onSelectedAssignmentIdsChange={setAssignmentIdsPendingRemoval}
                          isRemovingAssignment={isRemovingAssignment}
                          onConfirmRemove={confirmRemoveAssignment}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isRemovingAssignment}
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
            </section>
          ) : null}

          {activeSection === 'cycles' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              {trackingByYear.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><SendIcon /></EmptyMedia>
                    <EmptyTitle>Sem dados de validação</EmptyTitle>
                    <EmptyDescription>Assim que as secretarias classificarem ações, o acompanhamento aparecerá aqui.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                trackingByYear.map((year) => {
                  const orgsSent = year.orgs.filter((o) => o.sent > 0).length;
                  return (
                    <Card key={year.year}>
                      <CardHeader>
                        <CardTitle>Exercício {year.year}</CardTitle>
                        <CardDescription>
                          {orgsSent} de {year.orgs.length} secretaria{year.orgs.length !== 1 ? 's' : ''} já enviaram informações — {year.total} validaç{year.total !== 1 ? 'ões' : 'ão'} no total.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {(['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'] as const).map((status) => (
                            <div key={status} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                              <StatusBadge status={status} />
                              <span className="text-lg font-semibold">{year.byStatus[status] ?? 0}</span>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Progresso por secretaria</p>
                          {year.orgs.map((org) => (
                            <div key={org.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5 text-sm">
                              <span className="font-medium">{org.code} - {org.name}</span>
                              <span className="text-muted-foreground">{org.sent} de {org.total} enviada{org.total !== 1 ? 's' : ''}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </section>
          ) : null}

          {activeSection === 'review' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              {reviewByOrg.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SendIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma validação enviada pelas secretarias ainda</EmptyTitle>
                    <EmptyDescription>As entregas aparecerão aqui agrupadas por secretaria assim que forem enviadas.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                (() => {
                  const defaultOpen = reviewByOrg
                    .filter((o) => (o.byStatus['ENVIADO'] ?? 0) > 0)
                    .map((o) => o.code);
                  return (
                    <Accordion type="multiple" defaultValue={defaultOpen} className="flex flex-col gap-3">
                      {reviewByOrg.map((org) => {
                        const pending = org.byStatus['ENVIADO'] ?? 0;
                        const total = org.items.length;
                        return (
                          <AccordionItem key={org.code} value={org.code}>
                            <AccordionTrigger>
                              <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-snug">{org.code} - {org.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {total} validaç{total !== 1 ? 'ões' : 'ão'}
                                    {pending > 0 ? ` · ${pending} pendente${pending !== 1 ? 's' : ''} de revisão` : ''}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {pending > 0 ? (
                                    <Badge className="bg-primary text-primary-foreground">{pending} a revisar</Badge>
                                  ) : null}
                                  {(['RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO'] as const)
                                    .filter((s) => (org.byStatus[s] ?? 0) > 0)
                                    .map((s) => (
                                      <span key={s} className="flex items-center gap-1.5 text-xs">
                                        <StatusBadge status={s} />
                                        <span className="font-semibold tabular-nums">{org.byStatus[s]}</span>
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="grid gap-3">
                                {org.items.map((validation) => {
                                  const municipalities = Array.from(
                                    new Set(
                                      (validation.deliveries ?? [])
                                        .map((d) => d.municipality?.trim())
                                        .filter((m): m is string => Boolean(m)),
                                    ),
                                  );
                                  const municipalitiesLabel =
                                    municipalities.length === 0
                                      ? '—'
                                      : municipalities.length <= 2
                                        ? municipalities.join(', ')
                                        : `${municipalities.slice(0, 2).join(', ')} +${municipalities.length - 2}`;
                                  const deliveriesCount = validation.deliveries?.length ?? 0;
                                  const hasExecValue =
                                    typeof validation.informedExecutedValue === 'number' && validation.informedExecutedValue > 0;
                                  return (
                                    <Card key={validation.id} size="sm">
                                      <CardHeader>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <ThemeBadge theme={validation.theme} />
                                          <StatusBadge status={validation.status} />
                                        </div>
                                        <CardTitle className="mt-2">{validation.action?.application}</CardTitle>
                                        <CardDescription>
                                          {validation.action?.projectActivity}
                                          {validation.action?.unitCode ? ` · ${validation.action.unitCode} - ${validation.action.unitName}` : ''}
                                        </CardDescription>
                                        <CardAction className="flex flex-wrap gap-2">
                                          <Button
                                            variant="outline"
                                            disabled={validation.status !== 'ENVIADO'}
                                            onClick={() => void reviewValidation(validation.id, 'approve')}
                                          >
                                            <CheckCircle2Icon data-icon="inline-start" />
                                            Aprovar
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            disabled={validation.status !== 'ENVIADO'}
                                            onClick={() => void reviewValidation(validation.id, 'return')}
                                          >
                                            <RotateCcwIcon data-icon="inline-start" />
                                            Devolver
                                          </Button>
                                          <Button
                                            variant="outline"
                                            className="text-muted-foreground"
                                            disabled={validation.status !== 'APROVADO'}
                                            onClick={() => void revertApproval(validation.id)}
                                          >
                                            <RotateCcwIcon data-icon="inline-start" />
                                            Reverter aprovação
                                          </Button>
                                        </CardAction>
                                      </CardHeader>
                                      <CardContent className="flex flex-col gap-3">
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                          <div className="rounded-md border bg-muted/30 px-3 py-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Entregas</p>
                                            <p className="mt-0.5 text-base font-semibold tabular-nums">{deliveriesCount}</p>
                                          </div>
                                          <div className="rounded-md border bg-muted/30 px-3 py-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor executado</p>
                                            <p className="mt-0.5 text-base font-semibold tabular-nums">
                                              {hasExecValue ? formatMoney(validation.informedExecutedValue!) : '—'}
                                            </p>
                                          </div>
                                          <div className="rounded-md border bg-muted/30 px-3 py-2" title={municipalities.join(', ')}>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Municípios</p>
                                            <p className="mt-0.5 truncate text-base font-semibold">{municipalitiesLabel}</p>
                                          </div>
                                        </div>
                                        {validation.realizedDescription ? (
                                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Descrição informada</p>
                                            <p className="mt-1 text-sm leading-snug text-foreground">{validation.realizedDescription}</p>
                                          </div>
                                        ) : null}
                                        <DeliveryReviewList
                                          deliveries={validation.deliveries}
                                          informedExecutedValue={validation.informedExecutedValue}
                                          theme={validation.theme}
                                          classification={validation.assignment?.classification}
                                        />
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  );
                })()
              )}
            </section>
          ) : null}

          {activeSection === 'results' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Resultados finais dos Orçamentos Temáticos</CardTitle>
                  <CardDescription>
                    Programas classificados, com entregas registradas e validações aprovadas — encerramento do ciclo de curadoria, validação e revisão.
                  </CardDescription>
                  <CardAction>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button disabled={approvedValidations.length === 0}>
                          <FileDownIcon data-icon="inline-start" />
                          Exportar
                          <ChevronDownIcon className="ml-1 size-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" side="bottom" className="w-56 p-2">
                        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Formato do relatório
                        </p>
                        <button
                          type="button"
                          onClick={handleExportXlsx}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
                          <span className="flex-1 text-left">XLSX</span>
                          <span className="text-xs text-muted-foreground">Planilha</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <FileDownIcon className="size-4 text-muted-foreground" />
                          <span className="flex-1 text-left">CSV</span>
                          <span className="text-xs text-muted-foreground">Texto</span>
                        </button>
                      </PopoverContent>
                    </Popover>
                  </CardAction>
                </CardHeader>
              </Card>

              {approvedValidations.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><FileBarChart2Icon /></EmptyMedia>
                    <EmptyTitle>Nenhum resultado consolidado ainda</EmptyTitle>
                    <EmptyDescription>
                      Aprove validações na seção Revisão para que apareçam aqui no relatório final.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                resultsByTheme.map((entry) => {
                  const hasItems = entry.items.length > 0;
                  return (
                    <Card key={entry.theme}>
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <ThemeBadge theme={entry.theme} />
                        </div>
                        <CardTitle className="mt-2">{entry.label}</CardTitle>
                        <CardDescription>
                          {hasItems
                            ? `${entry.actionCount} aç${entry.actionCount !== 1 ? 'ões' : 'ão'} validada${entry.actionCount !== 1 ? 's' : ''} em ${entry.orgCount} secretaria${entry.orgCount !== 1 ? 's' : ''}.`
                            : 'Sem validações aprovadas para este tema.'}
                        </CardDescription>
                        <CardAction>
                          <Badge variant={hasItems ? 'default' : 'secondary'}>
                            {entry.items.length} validaç{entry.items.length !== 1 ? 'ões' : 'ão'}
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                          {[
                            { label: 'Ações validadas', value: entry.actionCount.toLocaleString('pt-BR') },
                            { label: 'Secretarias', value: entry.orgCount.toLocaleString('pt-BR') },
                            { label: 'Entregas', value: entry.deliveriesCount.toLocaleString('pt-BR') },
                            { label: 'Valor liquidado', value: formatMoney(entry.liquidated) },
                            { label: 'Valor executado', value: formatMoney(entry.executed) },
                          ].map((kpi) => (
                            <div key={kpi.label} className="min-w-0 rounded-lg border bg-muted/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{kpi.value}</p>
                            </div>
                          ))}
                        </div>

                        {hasItems ? (
                          <div className="min-w-0 overflow-hidden rounded-lg border">
                            <ScrollArea className="w-full">
                              <Table className="min-w-[60rem]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-9 w-8 px-2" aria-label="Expandir" />
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Secretaria</TableHead>
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Unidade</TableHead>
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Ação</TableHead>
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Eixo</TableHead>
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Classificação</TableHead>
                                    <TableHead className="h-9 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Pond.</TableHead>
                                    <TableHead className="h-9 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Entregas</TableHead>
                                    <TableHead className="h-9 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Liquidado</TableHead>
                                    <TableHead className="h-9 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Executado</TableHead>
                                    <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Ciclo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entry.items.map((v) => {
                                    const isExpanded = expandedResultRows.has(v.id);
                                    const hasDeliveries = (v.deliveries?.length ?? 0) > 0;
                                    return (
                                    <Fragment key={v.id}>
                                    <TableRow>
                                      <TableCell className="w-8 px-2 py-2 align-top">
                                        <button
                                          type="button"
                                          onClick={() => toggleResultRow(v.id)}
                                          disabled={!hasDeliveries}
                                          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                          aria-label={isExpanded ? 'Recolher entregas' : 'Expandir entregas'}
                                          aria-expanded={isExpanded}
                                        >
                                          <ChevronDownIcon className={cn('size-4 transition-transform', isExpanded && 'rotate-180')} />
                                        </button>
                                      </TableCell>
                                      <TableCell className="py-2 align-top text-sm">
                                        <span className="block font-medium leading-snug">{v.action?.organizationCode}</span>
                                        <span className="block text-xs text-muted-foreground">{v.action?.organizationName}</span>
                                      </TableCell>
                                      <TableCell className="py-2 align-top text-sm">
                                        <span className="block">{v.action?.unitCode}</span>
                                        <span className="block text-xs text-muted-foreground">{v.action?.unitName}</span>
                                      </TableCell>
                                      <TableCell className="py-2 align-top text-sm">
                                        <span className="block font-medium leading-snug">{v.action?.application}</span>
                                        <span className="block text-xs text-muted-foreground">{v.action?.projectActivity}</span>
                                      </TableCell>
                                      <TableCell className="py-2 align-top text-sm">{v.assignment?.axis ?? '—'}</TableCell>
                                      <TableCell className="py-2 align-top text-sm">{v.assignment?.classification ?? '—'}</TableCell>
                                      <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                        {typeof v.assignment?.weightingFactor === 'number'
                                          ? v.assignment.weightingFactor.toLocaleString('pt-BR')
                                          : '—'}
                                      </TableCell>
                                      <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                        {v.deliveries?.length ?? 0}
                                      </TableCell>
                                      <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                        {formatMoney(v.action?.totals?.liquidated ?? 0)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                        {formatMoney(v.informedExecutedValue ?? 0)}
                                      </TableCell>
                                      <TableCell className="py-2 align-top text-sm">
                                        <span className="block">{v.cycle?.name ?? '—'}</span>
                                        <span className="block text-xs text-muted-foreground">{v.cycle?.year ?? v.action?.year ?? ''}</span>
                                      </TableCell>
                                    </TableRow>
                                    {isExpanded && hasDeliveries ? (
                                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell />
                                        <TableCell colSpan={10} className="py-3">
                                          {v.realizedDescription ? (
                                            <div className="mb-3 rounded-md border bg-background px-3 py-2">
                                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Descrição informada</p>
                                              <p className="mt-1 text-sm leading-snug text-foreground">{v.realizedDescription}</p>
                                            </div>
                                          ) : null}
                                          <DeliveryReviewList
                                            deliveries={v.deliveries}
                                            informedExecutedValue={v.informedExecutedValue}
                                            theme={v.theme}
                                            classification={v.assignment?.classification}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ) : null}
                                    </Fragment>
                                    );
                                  })}
                                  <TableRow className="bg-muted/40 font-semibold">
                                    <TableCell />
                                    <TableCell className="py-2 text-sm" colSpan={6}>Total do tema</TableCell>
                                    <TableCell className="py-2 text-right text-sm tabular-nums">{entry.deliveriesCount}</TableCell>
                                    <TableCell className="py-2 text-right text-sm tabular-nums">{formatMoney(entry.liquidated)}</TableCell>
                                    <TableCell className="py-2 text-right text-sm tabular-nums">{formatMoney(entry.executed)}</TableCell>
                                    <TableCell />
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </section>
          ) : null}

          {activeSection === 'reports' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <Tabs
                value={reportsViewTab}
                onValueChange={(value) => setReportsViewTab(value as 'overview' | 'by-axis')}
              >
                <TabsList className="w-fit">
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="by-axis">Execução por eixo</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-5 flex flex-col gap-5">
                  <Card >
                    <CardHeader>
                      <CardTitle>Execução dos orçamentos temáticos</CardTitle>
                      <CardDescription>Percentual de execução por tema — liquidado sobre a dotação atualizada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {themeGaugeData.map(({ key, label, liquidated, planned, pct }) => (
                          <div key={key} className="flex flex-col items-center gap-2">
                            <div className="relative mx-auto w-[220px]">
                              <PieChart width={220} height={120}>
                                <Pie
                                  data={[{ value: pct }, { value: 100 - pct }]}
                                  cx={110}
                                  cy={110}
                                  startAngle={180}
                                  endAngle={0}
                                  innerRadius={68}
                                  outerRadius={100}
                                  dataKey="value"
                                  strokeWidth={0}
                                >
                                  <Cell fill={gaugeColor(pct)} />
                                  <Cell fill="var(--color-muted)" />
                                </Pie>
                              </PieChart>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                                <p className="text-2xl font-bold tabular-nums">{pct.toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold">{key}</p>
                              <p className="max-w-[180px] text-xs text-muted-foreground leading-snug">{label}</p>
                              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {formatMoney(liquidated)} / {formatMoney(planned)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle>Resumo por tema</CardTitle>
                        <CardDescription>Valores liquidados das ações classificadas por orçamento temático.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col">
                        <ThemeLiquidatedSummaryChart
                          className="min-h-0 flex-1"
                          data={summary?.totalsByTheme ?? []}
                        />
                      </CardContent>
                    </Card>

                    <Card >
                      <CardHeader>
                        <CardTitle>Status das validações</CardTitle>
                        <CardDescription>Distribuição atual dos formulários enviados às secretarias.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        {summary?.validationsByStatus.map((item) => (
                          <div key={item.status} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                            <StatusBadge status={item.status} />
                            <span className="text-xl font-semibold">{item.count}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="by-axis" className="mt-5">
                  <Card>
                    <CardHeader>
                      <CardTitle>Execução por eixo</CardTitle>
                      <CardDescription>
                        Valores liquidados e percentual de execução por eixo dentro de cada orçamento temático.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs
                        value={reportsThemeTab}
                        onValueChange={(value) => setReportsThemeTab(value as ThemeBudget)}
                      >
                        <TabsList className="w-fit">
                          {(['OCAD', 'OSG', 'CLIMATICO'] as const).map((theme) => {
                            const tabTotals = themeAxisTotals(axisReport, theme, actions);
                            return (
                              <TabsTrigger key={theme} value={theme} className="gap-1.5">
                                {themeLabels[theme]}
                                {tabTotals.actionsCount > 0 ? (
                                  <span
                                    className="size-1.5 shrink-0 rounded-full bg-primary"
                                    aria-hidden
                                  />
                                ) : null}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                        {(['OCAD', 'OSG', 'CLIMATICO'] as const).map((theme) => {
                          const themeRows = filterAxisReportByTheme(axisReport, theme);
                          const totals = themeAxisTotals(axisReport, theme, actions);
                          const classificationThemeRows = filterAxisReportByTheme(
                            classificationReport,
                            theme,
                          );
                          const classificationThemeTotals = themeAxisTotals(
                            classificationReport,
                            theme,
                            actions,
                          );
                          const hasClassifications = totals.actionsCount > 0;

                          return (
                            <TabsContent key={theme} value={theme} className="mt-4">
                              {hasClassifications ? (
                                <AxisExecutionByThemePanel
                                  theme={theme}
                                  rows={themeRows}
                                  totals={totals}
                                  classificationRows={classificationThemeRows}
                                  classificationTotals={classificationThemeTotals}
                                />
                              ) : (
                                <Empty>
                                  <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                      <BarChart3Icon />
                                    </EmptyMedia>
                                    <EmptyTitle>Nenhuma ação classificada neste tema</EmptyTitle>
                                    <EmptyDescription>
                                      Classifique ações nos eixos de {themeLabels[theme]} para visualizar a execução por eixo.
                                    </EmptyDescription>
                                  </EmptyHeader>
                                </Empty>
                              )}
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </section>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ActionsTableCard({
  title,
  description,
  table,
  organizations,
  themeSummary,
  qddStats,
  onOpenStructure,
  columnFilters,
  onColumnFiltersChange,
  themePopoverOpen,
  onThemePopoverOpenChange,
  qddPopoverOpen,
  onQddPopoverOpenChange,
}: {
  title: string;
  description: string;
  table: ReturnType<typeof useReactTable<BudgetAction>>;
  organizations: { code: string; name: string }[];
  themeSummary: { theme: ThemeBudget; actions: number; liquidated: number }[];
  qddStats: { organizationCount: number; unitCount: number; expenseLineCount: number; actionCount: number };
  onOpenStructure: () => void;
  columnFilters: ActionColumnFilters;
  onColumnFiltersChange: (filters: ActionColumnFilters) => void;
  themePopoverOpen: boolean;
  onThemePopoverOpenChange: (open: boolean) => void;
  qddPopoverOpen: boolean;
  onQddPopoverOpenChange: (open: boolean) => void;
}) {
  const totalPages = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(table.getState().pagination.pageIndex + 1, totalPages);
  const pageItems: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      pageItems.push(page);
    }
  } else {
    pageItems.push(1);

    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) {
      pageItems.push('ellipsis-left');
    }

    for (let page = windowStart; page <= windowEnd; page += 1) {
      pageItems.push(page);
    }

    if (windowEnd < totalPages - 1) {
      pageItems.push('ellipsis-right');
    }

    pageItems.push(totalPages);
  }

  return (
    <Card >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <OrgaoCombobox
            value={columnFilters.organizationCode}
            organizations={organizations}
            onChange={(value) => onColumnFiltersChange({ ...columnFilters, organizationCode: value })}
          />
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              className="pl-9 w-56"
              placeholder="Ação consolidada"
              autoComplete="off"
              value={columnFilters.application}
              onChange={(event) => onColumnFiltersChange({ ...columnFilters, application: event.target.value })}
            />
          </div>
          <Select
            value={columnFilters.theme}
            onValueChange={(value) => onColumnFiltersChange({ ...columnFilters, theme: value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={allValue}>Todos os temas</SelectItem>
                {Object.entries(themeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px]">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5 leading-tight whitespace-normal align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <Separator className="my-3" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-1">
              {pageItems.map((item) => (
                typeof item === 'number'
                  ? (
                    <Button
                      key={item}
                      variant={item === currentPage ? 'secondary' : 'ghost'}
                      size="sm"
                      className="min-w-7 px-2"
                      onClick={() => table.setPageIndex(item - 1)}
                    >
                      {item}
                    </Button>
                  )
                  : <span key={item} className="px-1">...</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Anterior
            </Button>
            <Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrgaoCombobox({
  value,
  organizations,
  onChange,
  className = 'relative w-52',
}: {
  value: string;
  organizations: { code: string; name: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOrg = organizations.find((o) => o.code === value);
  const displayValue = value === allValue ? 'Todos os órgãos' : selectedOrg ? `${selectedOrg.code} - ${selectedOrg.name}` : '';
  const matchTriggerWidth = /\bw-full\b/.test(className ?? '');

  const allItems = [
    { code: allValue, label: 'Todos os órgãos' },
    ...organizations.map((o) => ({ code: o.code, label: `${o.code} - ${o.name}` })),
  ];

  const filtered = inputValue
    ? allItems.filter((item) => normalize(item.label).includes(normalize(inputValue)))
    : allItems;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setInputValue('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <div
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        onClick={() => setOpen(true)}
      >
        <input
          className="flex-1 w-full min-w-0 truncate bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Todos os órgãos"
          value={open ? inputValue : displayValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setInputValue('');
            setOpen(true);
          }}
        />
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-80 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
            matchTriggerWidth ? 'left-0 right-0 w-full min-w-0' : 'right-0 w-80 sm:right-auto sm:left-0',
          )}
        >
          {filtered.length > 0 ? filtered.map((item) => (
            <button
              key={item.code}
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted hover:text-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item.code);
                setInputValue('');
                setOpen(false);
              }}
            >
              {item.code === value ? <CheckIcon className="size-4 shrink-0" /> : <span className="inline-block size-4 shrink-0" />}
              {item.label}
            </button>
          )) : (
            <div className="py-2 text-center text-sm text-muted-foreground">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
}


function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
