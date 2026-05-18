'use client';

import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FolderCogIcon,
  GaugeIcon,
  LockIcon,
  LogOutIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels, type Session } from '@/lib/api';
import type { BudgetAction, BudgetImport, Metadata, QddPeriodType, Summary, ThematicAssignment, ThemeBudget, ValidationCycle, ValidationItem } from '@/types/domain';

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

type SectionId = 'overview' | 'structure' | 'curation' | 'cycles' | 'review' | 'reports';

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

const chartConfig = {
  liquidated: {
    label: 'Liquidado',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

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
  const [cycles, setCycles] = useState<ValidationCycle[]>([]);
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
  const [cycle, setCycle] = useState({ name: 'Ciclo de Validação 2026', year: 2026, theme: 'OSG' as ThemeBudget });
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
    const [meta, summaryData, actionData, validationData, importsData, cyclesData] = await Promise.all([
      api<Metadata>('/metadata'),
      api<Summary>('/reports/summary'),
      api<BudgetAction[]>('/budget-actions'),
      api<ValidationItem[]>('/validations/my'),
      api<BudgetImport[]>('/imports/qdd'),
      api<ValidationCycle[]>('/validation-cycles'),
    ]);
    setMetadata(meta);
    setSummary(summaryData);
    setActions(actionData);
    setValidations(validationData);
    setImportHistory(importsData);
    setCycles(cyclesData);
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
    try {
      await api<ThematicAssignment>('/thematic-assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...assignment,
          actionId: selectedActionId,
          weightingFactor: assignment.weightingFactor ? Number(assignment.weightingFactor) : undefined,
        }),
      });
      toast.success('Ação classificada no orçamento temático.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao classificar ação.');
    }
  }

  async function confirmRemoveAssignment() {
    const action = actions.find((a) => a.id === selectedActionId);
    if (!selectedActionId || isRemovingAssignment || !action) return;
    const validIds = new Set(action.assignments.map((a) => a.id));
    const idsToRemove = assignmentIdsPendingRemoval.filter((id) => validIds.has(id));
    if (idsToRemove.length === 0) return;

    setIsRemovingAssignment(true);
    let removedCount = 0;
    try {
      for (const id of idsToRemove) {
        try {
          await api(`/thematic-assignments/${id}`, { method: 'DELETE' });
          removedCount++;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao remover a classificação.');
          if (removedCount > 0) {
            toast.warning(`${removedCount} classificação(ões) removida(s) antes do erro.`);
          }
          await load();
          return;
        }
      }
      toast.success(
        removedCount === 1 ? 'Classificação removida.' : `${removedCount} classificações removidas.`,
      );
      setRemovePopoverOpen(false);
      setAssignmentIdsPendingRemoval([]);
      await load();
    } finally {
      setIsRemovingAssignment(false);
    }
  }

  async function createCycle() {
    try {
      await api('/validation-cycles', {
        method: 'POST',
        body: JSON.stringify(cycle),
      });
      toast.success('Ciclo aberto e validações geradas.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir ciclo de validação.');
    }
  }

  async function closeCycleById(id: string) {
    await api(`/validation-cycles/${id}/close`, { method: 'POST' });
    toast.success('Ciclo encerrado com sucesso.');
    await load();
  }

  async function deleteCycleById(id: string) {
    await api(`/validation-cycles/${id}`, { method: 'DELETE' });
    toast.success('Ciclo excluído.');
    await load();
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
    if (!removePopoverOpen) return;
    setAssignmentIdsPendingRemoval([]);
  }, [removePopoverOpen]);

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
    { id: 'cycles', label: 'Ciclos', icon: SendIcon, badge: summary?.cycles ?? 0 },
    { id: 'review', label: 'Revisão', icon: ClipboardCheckIcon, badge: validations.length },
    { id: 'reports', label: 'Relatórios', icon: BarChart3Icon },
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
                {[navItems[0], navItems[5]].map((item) => {
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
                {[navItems[3], navItems[4]].map((item) => {
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
                  <TabsTrigger value="actions">Ações</TabsTrigger>
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
                      <Select value={assignment.theme} onValueChange={(value) => setAssignment({ ...assignment, theme: value as ThemeBudget, axis: '', classification: '' })}>
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
                      <Select value={assignment.classification || 'UNSELECTED'} onValueChange={(value) => setAssignment({ ...assignment, classification: value === 'UNSELECTED' ? '' : value })}>
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
                    <Field>
                      <FieldLabel htmlFor="weightingFactor">Ponderador</FieldLabel>
                      <Input id="weightingFactor" type="number" min="0" max="1" step="0.01" value={assignment.weightingFactor} onChange={(event) => setAssignment({ ...assignment, weightingFactor: event.target.value })} placeholder="Opcional" />
                    </Field>
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
            <section className="grid min-h-0 flex-1 gap-5 overflow-y-auto xl:grid-cols-[430px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]">
              <div className="flex flex-col gap-5">
                <Card >
                  <CardHeader>
                    <CardTitle>Abrir ciclo</CardTitle>
                    <CardDescription>Gere validações para as secretarias a partir das ações classificadas no exercício.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="cycleName">Nome do ciclo</FieldLabel>
                        <Input id="cycleName" value={cycle.name} onChange={(event) => setCycle({ ...cycle, name: event.target.value })} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="cycleYear">Exercício</FieldLabel>
                        <Input id="cycleYear" type="number" value={cycle.year} onChange={(event) => setCycle({ ...cycle, year: Number(event.target.value) })} />
                      </Field>
                      <Field>
                        <FieldLabel>Tema orçamentário</FieldLabel>
                        <Select value={cycle.theme} onValueChange={(value) => setCycle({ ...cycle, theme: value as ThemeBudget })}>
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
                      <Alert className="border-primary/25 bg-primary/5">
                        <SendIcon />
                        <AlertDescription className="text-xs">
                          Ao abrir um ciclo, são geradas automaticamente validações para todas as ações classificadas como
                          <strong> {themeLabels[cycle.theme]}</strong> no exercício <strong>{cycle.year}</strong> que estejam prontas para validação.
                        </AlertDescription>
                      </Alert>
                      <Button onClick={() => void createCycle()}>
                        <SendIcon data-icon="inline-start" />
                        Abrir ciclo de validação
                      </Button>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card >
                  <CardHeader>
                    <CardTitle>Situação atual</CardTitle>
                    <CardDescription>Panorama das classificações e ciclos registrados no sistema.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat label="Ações classificadas" value={summary?.assignments ?? 0} />
                      <MiniStat label="Ciclos abertos" value={cycles.filter((c) => c.status === 'ABERTO').length} />
                    </div>
                    <Separator />
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Validações por status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {summary?.validationsByStatus.map((item) => (
                        <div key={item.status} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                          <StatusBadge status={item.status} />
                          <span className="text-lg font-semibold">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card >
                <CardHeader>
                  <CardTitle>Ciclos de validação</CardTitle>
                  <CardDescription>
                    {cycles.length === 0
                      ? 'Nenhum ciclo registrado. Use o formulário ao lado para criar o primeiro.'
                      : `${cycles.length} ciclo${cycles.length !== 1 ? 's' : ''} registrado${cycles.length !== 1 ? 's' : ''} — ${cycles.filter((c) => c.status === 'ABERTO').length} aberto${cycles.filter((c) => c.status === 'ABERTO').length !== 1 ? 's' : ''}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cycles.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><SendIcon /></EmptyMedia>
                        <EmptyTitle>Nenhum ciclo aberto</EmptyTitle>
                        <EmptyDescription>Classifique ações temáticas e abra o primeiro ciclo de validação.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <ScrollArea className="h-[640px] pr-1">
                      <div className="flex flex-col gap-3">
                        {cycles.map((c) => (
                          <CycleCard key={c.id} cycle={c} onClose={() => void closeCycleById(c.id)} onDelete={() => void deleteCycleById(c.id)} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {activeSection === 'review' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">

              <div className="grid gap-3">
                {validations.map((validation) => (
                  <Card key={validation.id} size="sm" >
                    <CardHeader>
                      <CardTitle>{validation.action?.application}</CardTitle>
                      <CardDescription>{validation.action?.organizationCode} - {validation.action?.organizationName}</CardDescription>
                      <CardAction className="flex gap-2">
                        <StatusBadge status={validation.status} />
                        <ThemeBadge theme={validation.theme} />
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {validation.realizedDescription ? <p className="text-sm text-muted-foreground">{validation.realizedDescription}</p> : null}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" disabled={validation.status !== 'ENVIADO'} onClick={() => void reviewValidation(validation.id, 'approve')}>
                          <CheckCircle2Icon data-icon="inline-start" />
                          Aprovar
                        </Button>
                        <Button variant="destructive" disabled={validation.status !== 'ENVIADO'} onClick={() => void reviewValidation(validation.id, 'return')}>
                          <RotateCcwIcon data-icon="inline-start" />
                          Devolver
                        </Button>
                        <Button variant="outline" className="text-muted-foreground" disabled={validation.status !== 'APROVADO'} onClick={() => void revertApproval(validation.id)}>
                          <RotateCcwIcon data-icon="inline-start" />
                          Reverter aprovação
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!validations.length ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SendIcon />
                      </EmptyMedia>
                      <EmptyTitle>Nenhuma validação gerada</EmptyTitle>
                      <EmptyDescription>Abra um ciclo depois de classificar as ações temáticas.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'reports' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
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

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card >
                  <CardHeader>
                    <CardTitle>Resumo por tema</CardTitle>
                    <CardDescription>Valores liquidados das ações classificadas por orçamento temático.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-96 w-full">
                      <BarChart accessibilityLayer data={summary?.totalsByTheme ?? []}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="theme" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />} />
                        <Bar dataKey="liquidated" fill="var(--color-liquidated)" radius={4} />
                      </BarChart>
                    </ChartContainer>
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


function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function CycleCard({ cycle, onClose, onDelete }: { cycle: ValidationCycle; onClose: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const total = cycle.validationCount;
  const approved = cycle.validationsByStatus.find((v) => v.status === 'APROVADO')?.count ?? 0;
  const submitted = cycle.validationsByStatus.find((v) => v.status === 'ENVIADO')?.count ?? 0;
  const returned = cycle.validationsByStatus.find((v) => v.status === 'DEVOLVIDO')?.count ?? 0;
  const draft = cycle.validationsByStatus.find((v) => v.status === 'RASCUNHO')?.count ?? 0;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const completedRate = total > 0 ? Math.round(((approved + returned) / total) * 100) : 0;
  const isOpen = cycle.status === 'ABERTO';

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 flex flex-col gap-3 shadow-sm', isOpen && 'border-primary')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{cycle.name}</span>
            <ThemeBadge theme={cycle.theme} />
            <Badge variant={isOpen ? 'default' : 'secondary'}>
              {isOpen ? 'Aberto' : 'Encerrado'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              Exercício {cycle.year}
            </span>
            <span>Aberto em {new Date(cycle.openedAt).toLocaleDateString('pt-BR')}</span>
            {cycle.closedAt ? (
              <span>Encerrado em {new Date(cycle.closedAt).toLocaleDateString('pt-BR')}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {isOpen ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              <LockIcon data-icon="inline-start" />
              Encerrar
            </Button>
          ) : null}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">Confirmar exclusão?</span>
              <Button variant="destructive" size="sm" onClick={() => { setConfirmDelete(false); onDelete(); }}>
                Excluir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {total > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {approved} aprovada{approved !== 1 ? 's' : ''} de {total} validaç{total !== 1 ? 'ões' : 'ão'}
              </span>
              <span className="font-medium">{approvalRate}% aprovado</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary/40 transition-all"
                style={{ width: `${completedRate}%` }}
              />
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
                style={{ width: `${approvalRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{completedRate}% revisado (aprovado + devolvido)</span>
              <span>{total - approved - returned - submitted} pendente{total - approved - returned - submitted !== 1 ? 's' : ''} de envio</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Rascunho', value: draft, status: 'RASCUNHO' as const },
              { label: 'Enviado', value: submitted, status: 'ENVIADO' as const },
              { label: 'Devolvido', value: returned, status: 'DEVOLVIDO' as const },
              { label: 'Aprovado', value: approved, status: 'APROVADO' as const },
            ].map((item) => (
              <div key={item.status} className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 p-2.5 text-center">
                <StatusBadge status={item.status} />
                <p className="text-xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma validação gerada para este ciclo. Verifique se existem ações classificadas como <strong>{themeLabels[cycle.theme]}</strong> no exercício <strong>{cycle.year}</strong>.
        </p>
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
