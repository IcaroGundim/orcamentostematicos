'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BarChart3Icon,
  BookOpenIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileBarChart2Icon,
  FileDownIcon,
  FileSpreadsheetIcon,
  ChevronRightIcon,
  FolderCogIcon,
  GaugeIcon,
  LogOutIcon,
  PackageIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Cell, Pie, PieChart } from 'recharts';
import { ThemeLiquidatedSummaryChart } from '@/components/charts/ThemeLiquidatedSummaryChart';
import { ClassificationLiquidatedSummaryChart } from '@/components/charts/ClassificationLiquidatedSummaryChart';
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
import { AcreDeliveriesMap } from '@/components/domain/acre-deliveries-map';
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
import { HoverTabsList, Tabs, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { SourceBreakdownTable } from '@/components/domain/source-breakdown-table';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { FunctionalClassificationFilters } from '@/components/domain/functional-classification-filters';
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import { AdminDeliveryWorkspace } from '@/components/domain/admin-delivery-workspace';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels, type Session } from '@/lib/api';
import { exerciseQuery, useExercise } from '@/lib/use-exercise';
import { ExerciseSelect } from '@/components/domain/exercise-select';
import {
  buildVerifiedDeliveryExecutedMap,
  isWeightingFactorLocked,
  lockedWeightingFactorLabel,
  resolveInformedExecutedValue,
  resolveWeightingFactor,
  shouldHideWeightingFactor,
  thematicBudgetContribution,
  weightingFactorFormValue,
} from '@/lib/classification-rules';
import {
  adminValidationFormSchema,
  emptyAdminValidationFormValues,
  toAdminValidationFormInput,
  type ValidationFormInput,
  type ValidationFormValues,
} from '@/lib/validation-schema';
import {
  appendActionAssignment,
  collectBulkRemoveTargets,
  decrementSummaryAssignments,
  incrementSummaryAssignments,
  patchActionAssignments,
  patchBulkActionAssignments,
  reconcileCurationSnapshot,
  type BulkRemoveThemeFilter,
} from '@/lib/curation-actions';
import { actionMatchesFunctionalFilters } from '@/lib/functional-classification';
import {
  buildAxisExecutionReport,
  buildClassificationExecutionReport,
  filterAxisReportByTheme,
  themeAxisTotals,
} from '@/lib/thematic-axis-report';
import type {
  BudgetAction,
  BudgetImport,
  ExecutionStructure,
  GovernmentStructure,
  Metadata,
  QddPeriodType,
  StructureDiff,
  Summary,
  ThematicAssignment,
  ThemeBudget,
  ValidationItem,
} from '@/types/domain';
import { ExecutionAssignmentCard } from '@/components/domain/execution-assignment-card';
import { ExercisesPanel } from '@/components/domain/exercises-panel';
import { RelocatedUnitsPanel } from '@/components/domain/relocated-units-panel';
import { OverviewScheduledActionsPanel } from '@/components/domain/overview-scheduled-actions-panel';
import { functionalColumnFilterMatches, type FunctionalColumnFilterValue } from '@/lib/functional-classification';
import { aggregateApprovedDeliveriesByMunicipality } from '@/lib/municipality-delivery-totals';
import { ThematicCurationPanel, type AssignmentForm } from '@/components/domain/thematic-curation-panel';
import { UsersPanel } from '@/components/domain/users-panel';
import { QddStructureReconciliationPanel } from '@/components/domain/qdd-structure-reconciliation-panel';
import type { ResultsThemeSummary } from '@/lib/results-export';

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
  /** Onde o exercício veio: `manual` é a escolha da SEPLAN no formulário. */
  yearDetectedFrom?: 'manual' | 'header' | 'filename' | 'fallback';
  /** Exercício que o próprio arquivo declara — confere contra o escolhido. */
  detectedYear?: number;
  detectedYearFrom?: 'header' | 'filename' | 'fallback';
  sampleActions: BudgetAction[];
};

type ReattachResult = {
  reattachedAssignments: number;
  unmatchedAssignments?: Array<{
    organizationCode: string; organizationName: string;
    unitCode: string; unitName: string; projectActivity: string; application: string;
  }>;
};

type DeleteImportResult = {
  deleted: BudgetImport;
  reattachedAssignments: number;
};

/**
 * Exercício mais antigo que o sistema comporta. 2025 entrou apenas para comparação
 * com 2026; anos anteriores não fazem parte do escopo.
 */
const EARLIEST_IMPORT_YEAR = 2025;

/**
 * Exercícios oferecidos na importação: do próximo ano (para carregar o QDD antes de
 * o exercício começar) até `EARLIEST_IMPORT_YEAR`. O limite superior vem do relógio
 * para não exigir manutenção anual.
 */
const IMPORT_YEAR_OPTIONS: number[] = Array.from(
  { length: Math.max(1, new Date().getFullYear() + 1 - EARLIEST_IMPORT_YEAR + 1) },
  (_, i) => new Date().getFullYear() + 1 - i,
);

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

type SectionId = 'overview' | 'structure' | 'curation' | 'entregas' | 'review' | 'results' | 'reports';

type AdminSidebarNavItem = {
  id: SectionId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: number;
};

type AdminSidebarNavGroup = {
  label: string;
  items: AdminSidebarNavItem[];
};

function AdminSidebarNavigation({
  groups,
  activeSection,
  onSelect,
}: {
  groups: AdminSidebarNavGroup[];
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}) {
  const navigationRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef(activeSection);
  const highlightedSectionRef = useRef(activeSection);
  const [highlightedSection, setHighlightedSection] = useState(activeSection);
  const [highlight, setHighlight] = useState({ top: 0, left: 0, width: 0, height: 0, ready: false });

  const updateHighlight = useCallback((section: SectionId) => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const target = navigation.querySelector<HTMLElement>(`[data-admin-nav-item="${section}"]`);
    if (!target) return;

    const navigationRect = navigation.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setHighlight({
      top: targetRect.top - navigationRect.top,
      left: targetRect.left - navigationRect.left,
      width: targetRect.width,
      height: targetRect.height,
      ready: true,
    });
  }, []);

  const highlightSection = useCallback((section: SectionId) => {
    highlightedSectionRef.current = section;
    setHighlightedSection(section);
    updateHighlight(section);
  }, [updateHighlight]);

  useLayoutEffect(() => {
    activeSectionRef.current = activeSection;
    highlightedSectionRef.current = activeSection;
    setHighlightedSection(activeSection);
    updateHighlight(activeSection);
  }, [activeSection, updateHighlight]);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const onResize = () => updateHighlight(highlightedSectionRef.current);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(navigation);
    window.addEventListener('resize', onResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [updateHighlight]);

  return (
    <div
      ref={navigationRef}
      className="relative"
      onMouseLeave={() => highlightSection(activeSectionRef.current)}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-10 rounded-md bg-green-900 shadow-md',
          'transition-[top,left,width,height] duration-300 ease-out',
          highlight.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: highlight.top,
          left: highlight.left,
          width: highlight.width,
          height: highlight.height,
        }}
      />

      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isHighlighted = highlightedSection === item.id;

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeSection === item.id}
                      data-admin-nav-item={item.id}
                      tooltip={item.label}
                      onClick={() => onSelect(item.id)}
                      onFocus={() => highlightSection(item.id)}
                      onMouseEnter={() => highlightSection(item.id)}
                      className={cn(
                        'relative z-20 bg-transparent shadow-none transition-none',
                        'hover:bg-transparent hover:shadow-none focus:bg-transparent focus-visible:bg-transparent focus-visible:shadow-none data-active:bg-transparent data-active:shadow-none',
                        isHighlighted
                          ? 'text-white hover:text-white data-active:text-white [&_svg]:text-white data-active:[&_svg]:text-white'
                          : 'text-sidebar-foreground hover:text-sidebar-foreground data-active:text-sidebar-foreground [&_svg]:text-sidebar-foreground data-active:[&_svg]:text-sidebar-foreground',
                      )}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <SidebarMenuBadge
                        className={cn(
                          'z-30',
                          isHighlighted
                            ? 'text-white peer-data-active/menu-button:text-white'
                            : 'text-sidebar-foreground peer-data-active/menu-button:text-sidebar-foreground'
                        )}
                      >
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
}

type ActionColumnFilters = {
  organizationCode: string;
  application: string;
  theme: string;
  functionCode: string;
  subfunctionCode: string;
};

const allValue = 'ALL';

const REPORTS_VIEW_ITEMS: { value: 'overview' | 'by-axis'; label: string }[] = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'by-axis', label: 'Execução por eixo' },
];

const initialAssignment = {
  actionId: '',
  theme: 'OSG' as ThemeBudget,
  axis: '',
  classification: '',
  weightingFactor: '',
  justification: '',
};

function gaugeColor(pct: number): string {
  if (pct >= 75) return 'var(--color-chart-1)';
  if (pct >= 40) return 'var(--color-chart-3)';
  return 'var(--color-chart-4)';
}

// Contagem por status "de exibição": DEVOLVIDO é mostrado junto de RASCUNHO.
function displayStatusCount(byStatus: Record<string, number>, status: string): number {
  if (status === 'RASCUNHO') return (byStatus['RASCUNHO'] ?? 0) + (byStatus['DEVOLVIDO'] ?? 0);
  return byStatus[status] ?? 0;
}

function SeplanPageContent() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const { requestedYear, year, setYear } = useExercise(metadata?.currentYear);
  /** Exercício efetivamente carregado, conforme o servidor. */
  const loadedYear = metadata?.year ?? null;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importComparisonOnly, setImportComparisonOnly] = useState(false);
  const [importHistory, setImportHistory] = useState<BudgetImport[]>([]);
  const [executionStructure, setExecutionStructure] = useState<ExecutionStructure>({ organizations: [] });
  const [governmentStructure, setGovernmentStructure] = useState<GovernmentStructure>({ organizations: [] });
  const [structureDiff, setStructureDiff] = useState<StructureDiff | null>(null);
  const [structureSubTab, setStructureSubTab] = useState('base');
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  // Prévia gerada pela coleta automática do SICAF, à espera de confirmação da SEPLAN.
  const [sicafPending, setSicafPending] = useState<(ImportPreview & { generatedAt?: string }) | null>(null);
  const [isOpeningSicaf, setIsOpeningSicaf] = useState(false);
  const [isTriggeringSicaf, setIsTriggeringSicaf] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [deletingImportId, setDeletingImportId] = useState('');
  const [isReattaching, setIsReattaching] = useState(false);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [removePopoverOpen, setRemovePopoverOpen] = useState(false);
  const [assignmentIdsPendingRemoval, setAssignmentIdsPendingRemoval] = useState<string[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedPeriodType, setSelectedPeriodType] = useState<QddPeriodType>('ACUMULADO_ANUAL');
  /**
   * Exercício da importação, escolhido explicitamente. Começa `null` e assume o
   * exercício corrente assim que o metadata chega — a maioria das importações é do
   * ano em curso, e um valor errado aqui cria um exercício inteiro no lugar errado.
   */
  const [selectedImportYear, setSelectedImportYear] = useState<number | null>(null);
  const [selectedReferenceMonth, setSelectedReferenceMonth] = useState(new Date().getMonth() + 1);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [filter, setFilter] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [columnFilters, setColumnFilters] = useState<ActionColumnFilters>({
    organizationCode: allValue,
    application: '',
    theme: allValue,
    functionCode: allValue,
    subfunctionCode: allValue,
  });
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const [qddPopoverOpen, setQddPopoverOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [expandedResultRows, setExpandedResultRows] = useState<Set<string>>(new Set());
  const [reportsViewTab, setReportsViewTab] = useState<'overview' | 'by-axis'>('overview');
  const [reportsThemeTab, setReportsThemeTab] = useState<ThemeBudget>('OCAD');

  // Setas ← → alternam as subabas de "Informações Gerais". Fica no window (fase de
  // bubble) para funcionar sem depender de qual elemento está com foco; ignora campos
  // de formulário e as abas internas por tema (OCAD/OSG/CLIMATICO), que usam as setas
  // para a própria navegação.
  useEffect(() => {
    if (activeSection !== 'reports') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      if (target.closest('[data-slot="tabs-trigger"]')) return;
      setReportsViewTab(e.key === 'ArrowLeft' ? 'overview' : 'by-axis');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSection]);

  // Inserir Entregas (perfil administrador)
  const [adminDeliveryId, setAdminDeliveryId] = useState('');
  const [isSavingAdminDelivery, setIsSavingAdminDelivery] = useState(false);
  const [isFinalizingAdminDelivery, setIsFinalizingAdminDelivery] = useState(false);
  const adminDeliveryPrevIdRef = useRef<string | null>(null);
  const adminDeliveryForm = useForm<ValidationFormInput, unknown, ValidationFormValues>({
    resolver: zodResolver(adminValidationFormSchema),
    defaultValues: emptyAdminValidationFormValues(),
  });
  const adminDeliveries = useFieldArray({ control: adminDeliveryForm.control, name: 'deliveries' });
  const adminDeliveryCurrent = useMemo(
    () => validations.find((item) => item.id === adminDeliveryId) ?? null,
    [validations, adminDeliveryId],
  );
  useEffect(() => {
    if (!adminDeliveryCurrent) {
      adminDeliveryPrevIdRef.current = null;
      return;
    }
    if (adminDeliveryPrevIdRef.current !== adminDeliveryCurrent.id) {
      adminDeliveryForm.reset(toAdminValidationFormInput(adminDeliveryCurrent));
      adminDeliveryPrevIdRef.current = adminDeliveryCurrent.id;
    }
  }, [adminDeliveryCurrent, adminDeliveryForm]);

  function toggleResultRow(id: string) {
    setExpandedResultRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
  }, [router]);

  useEffect(() => {
    if (selectedImportYear != null) return;
    const fallback = metadata?.currentYear ?? new Date().getFullYear();
    setSelectedImportYear(fallback);
  }, [metadata?.currentYear, selectedImportYear]);

  // Carga separada da sessão: assim a troca de exercício recarrega os dados sem
  // reavaliar o redirecionamento.
  useEffect(() => {
    if (!session) return;
    load().catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados. O servidor pode estar indisponível.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, requestedYear]);

  const loadStructureDiff = useCallback(
    async (source: 'preview' | 'vigente', previewId?: string) => {
      const params = new URLSearchParams({ source });
      if (previewId) params.set('previewId', previewId);
      // Só a conferência do QDD vigente usa o exercício do contexto. Para uma prévia,
      // o exercício vem da própria prévia no servidor — mandar o do seletor foi o que
      // fez o QDD de um ano ser comparado com o cadastro de outro.
      if (source === 'vigente' && requestedYear != null) params.set('year', String(requestedYear));
      try {
        const diff = await api<StructureDiff>(`/government-structure/diff?${params.toString()}`);
        setStructureDiff(diff);
      } catch {
        setStructureDiff(null);
      }
    },
    [requestedYear],
  );

  async function load() {
    // `requestedYear` (e não `year`) para não recarregar quando o metadata chega.
    const q = exerciseQuery(requestedYear);
    const [meta, summaryData, actionData, validationData, importsData, executionData, govStructure] =
      await Promise.all([
        api<Metadata>(`/metadata${q}`),
        api<Summary>(`/reports/summary${q}`),
        api<BudgetAction[]>(`/budget-actions${q}`),
        api<ValidationItem[]>(`/validations/my${q}`),
        // O histórico de importações é deliberadamente de TODOS os exercícios.
        api<BudgetImport[]>('/imports/qdd'),
        api<ExecutionStructure>(`/execution/structure${q}`).catch(() => ({ organizations: [] })),
        api<GovernmentStructure>(`/government-structure${q}`).catch(() => ({ organizations: [] })),
      ]);
    setMetadata(meta);
    setSummary(summaryData);
    setActions(actionData);
    setValidations(validationData);
    setImportHistory(importsData);
    setExecutionStructure(executionData);
    setGovernmentStructure(govStructure);
    const firstAction = actionData[0]?.id ?? '';
    setSelectedActionId((current) => current || firstAction);
    setAssignment((current) => ({ ...current, actionId: current.actionId || firstAction }));

    const loaded = meta.year ?? null;
    if (importsData.some((i) => i.status === 'VIGENTE' && (loaded == null || i.year === loaded)) || actionData.length > 0) {
      await loadStructureDiff('vigente');
    } else {
      setStructureDiff(null);
    }
  }

  // Há prévia do SICAF pendente? A coleta agendada grava uma; aqui só a exibimos.
  const loadSicafPending = useCallback(async () => {
    try {
      const pending = await api<(ImportPreview & { generatedAt?: string }) | null>('/imports/qdd/pending');
      setSicafPending(pending ?? null);
    } catch {
      setSicafPending(null);
    }
  }, []);

  useEffect(() => {
    void loadSicafPending();
  }, [loadSicafPending]);

  // Dispara a coleta do QDD no SICAF a partir da tela. A raspagem roda no GitHub Actions
  // (não na Vercel); esta chamada só a aciona. A prévia aparece no banner segundos depois.
  async function triggerSicafCollection() {
    if (isTriggeringSicaf) return;
    setIsTriggeringSicaf(true);
    try {
      const exercicio = requestedYear ?? metadata?.currentYear ?? null;
      await api('/imports/qdd/from-sicaf/trigger', {
        method: 'POST',
        body: JSON.stringify(exercicio != null ? { exercicio } : {}),
      });
      toast.success(
        `Coleta do SICAF disparada${exercicio != null ? ` (exercício ${exercicio})` : ''}. ` +
          'A prévia aparecerá aqui em alguns instantes — use "Verificar prévia" para atualizar.',
        {
          description:
            'Se não aparecer, veja se a execução falhou em GitHub → Actions → "Coleta do QDD (SICAF)".',
          duration: 10000,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível disparar a coleta do SICAF.');
    } finally {
      setIsTriggeringSicaf(false);
    }
  }

  // Carrega a prévia do SICAF no MESMO fluxo de conferência do upload manual: a partir
  // daqui, reconciliação e `confirmImport` funcionam sem distinção de origem.
  async function openSicafPreview() {
    if (!sicafPending || isOpeningSicaf) return;
    setIsOpeningSicaf(true);
    try {
      setPreview(sicafPending);
      setStructureSubTab('reconciliation');
      await loadStructureDiff('preview', sicafPending.previewId);
      setActiveSection('structure');
      toast.success('Prévia do SICAF aberta para conferência.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir a prévia do SICAF.');
    } finally {
      setIsOpeningSicaf(false);
    }
  }

  async function uploadQdd(file: File) {
    setIsPreviewingImport(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('periodType', selectedPeriodType);
      formData.set('referenceMonth', String(selectedReferenceMonth));
      if (selectedImportYear != null) formData.set('year', String(selectedImportYear));
      const result = await api<ImportPreview>('/imports/qdd/preview', {
        method: 'POST',
        body: formData,
      });
      setPreview(result);
      setStructureSubTab('reconciliation');
      await loadStructureDiff('preview', result.previewId);
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
      const result = await api<ReattachResult>('/imports/qdd/confirm', {
        method: 'POST',
        body: JSON.stringify({ previewId: preview.previewId, comparisonOnly: importComparisonOnly }),
      });
      setPreview(null);
      setImportComparisonOnly(false);
      setStructureSubTab('reconciliation');
      void loadSicafPending(); // a prévia do SICAF é consumida no confirm; ressincroniza o aviso
      toast.success(
        importComparisonOnly
          ? 'QDD importado como exercício apenas comparativo.'
          : 'QDD importado e registrado como vigente.',
      );
      reportReattach(result);
      await load();
      await loadStructureDiff('vigente');
    } catch (err) {
      // Se a coleta agendada substituiu a prévia enquanto ela estava aberta, o confirm
      // devolve 404 ("prévia expirada"); ressincroniza o aviso para a SEPLAN reabrir.
      void loadSicafPending();
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar a importação do QDD.');
    } finally {
      setIsConfirmingImport(false);
    }
  }

  function reportReattach(result: ReattachResult) {
    if (result.reattachedAssignments > 0) {
      toast.success(`${result.reattachedAssignments} classificaç${result.reattachedAssignments === 1 ? 'ão religada' : 'ões religadas'} ao QDD vigente.`);
    }
    const unmatched = result.unmatchedAssignments ?? [];
    if (unmatched.length > 0) {
      toast.warning(
        `${unmatched.length} classificaç${unmatched.length === 1 ? 'ão não pôde' : 'ões não puderam'} ser religada${unmatched.length === 1 ? '' : 's'} (ação ausente no QDD novo).`,
        {
          description: unmatched
            .slice(0, 8)
            .map((a) => `${a.organizationCode}/${a.unitCode} · ${a.projectActivity}`)
            .join('\n') + (unmatched.length > 8 ? `\n… e mais ${unmatched.length - 8}.` : ''),
          duration: 12000,
        },
      );
    }
  }

  async function reattachAssignments() {
    if (isReattaching) return;
    setIsReattaching(true);
    try {
      const result = await api<ReattachResult>(
        `/imports/qdd/reattach?year=${loadedYear ?? metadata?.currentYear ?? ''}`,
        { method: 'POST' },
      );
      if (result.reattachedAssignments === 0 && (result.unmatchedAssignments ?? []).length === 0) {
        toast.success('Nenhuma classificação órfã encontrada — tudo já está vinculado ao QDD vigente.');
      } else {
        reportReattach(result);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recuperar as classificações.');
    } finally {
      setIsReattaching(false);
    }
  }

  async function deleteImport(importRecord: BudgetImport) {
    if (deletingImportId) return;
    const confirmed = window.confirm(
      `Excluir a importação ${formatPeriod(importRecord.referenceMonth, importRecord.year, importRecord.periodType)}?\n\n` +
      'As marcações e validações serão migradas para a ação equivalente em outro QDD. ' +
      'Se alguma não tiver correspondente, a exclusão será cancelada para não perder dados.',
    );
    if (!confirmed) return;

    setDeletingImportId(importRecord.id);
    try {
      const result = await api<DeleteImportResult>(`/imports/qdd/${importRecord.id}`, { method: 'DELETE' });
      toast.success(
        result.reattachedAssignments > 0
          ? `Importação excluída e ${result.reattachedAssignments} classificaç${result.reattachedAssignments === 1 ? 'ão preservada' : 'ões preservadas'}.`
          : 'Importação excluída.',
      );
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
      const optimistic = appendActionAssignment(actions, selectedActionId, created);
      setActions(optimistic);
      setSummary((current) => incrementSummaryAssignments(current, 1));
      try {
        await reconcileCurationSnapshot(optimistic, setActions, setSummary);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao classificar ação.');
    }
  }

  async function updateAssignment() {
    if (!selectedActionId) return;
    const action = actions.find((a) => a.id === selectedActionId);
    const existing = action?.assignments.find((a) => a.theme === assignment.theme);
    if (!existing) return;
    const snapshot = actions;
    try {
      const updated = await api<ThematicAssignment>(`/thematic-assignments/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          axis: assignment.axis,
          classification: assignment.classification,
          weightingFactor: resolveWeightingFactor(
            assignment.theme,
            assignment.classification,
            assignment.weightingFactor ? Number(assignment.weightingFactor) : undefined,
          ),
          justification: assignment.justification,
        }),
      });
      toast.success('Classificação atualizada.');
      const optimistic = appendActionAssignment(actions, selectedActionId, updated);
      setActions(optimistic);
      try {
        await reconcileCurationSnapshot(optimistic, setActions, setSummary);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar a classificação.');
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

      const optimistic =
        succeeded.length > 0 ? patchActionAssignments(snapshot, actionId, succeeded) : snapshot;
      if (succeeded.length > 0) {
        setActions(optimistic);
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
        await reconcileCurationSnapshot(optimistic, setActions, setSummary);
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

  async function confirmBulkRemoveAssignments(payload: {
    actionIds: string[];
    themeFilter: BulkRemoveThemeFilter;
  }) {
    if (isRemovingAssignment) return;

    const targets = collectBulkRemoveTargets(actions, payload.actionIds, payload.themeFilter);
    if (targets.length === 0) {
      toast.warning('Nenhuma classificação elegível para remover na seleção.');
      return;
    }

    const snapshot = actions;
    setIsRemovingAssignment(true);

    try {
      const results = await Promise.allSettled(
        targets.map((target) =>
          api(`/thematic-assignments/${target.assignmentId}`, { method: 'DELETE' }),
        ),
      );

      const removedByAction = new Map<string, string[]>();
      let firstError: string | null = null;

      results.forEach((result, index) => {
        const target = targets[index]!;
        if (result.status === 'fulfilled') {
          const list = removedByAction.get(target.actionId) ?? [];
          list.push(target.assignmentId);
          removedByAction.set(target.actionId, list);
        } else if (!firstError) {
          firstError =
            result.reason instanceof Error ? result.reason.message : 'Erro ao remover a classificação.';
        }
      });

      const totalRemoved = [...removedByAction.values()].reduce((sum, ids) => sum + ids.length, 0);

      const optimistic =
        totalRemoved > 0 ? patchBulkActionAssignments(snapshot, removedByAction) : snapshot;
      if (totalRemoved > 0) {
        setActions(optimistic);
        setSummary((prev) => decrementSummaryAssignments(prev, totalRemoved));
      } else {
        setActions(snapshot);
      }

      if (firstError) {
        toast.error(firstError);
        if (totalRemoved > 0) {
          toast.warning(`${totalRemoved} classificação(ões) removida(s) antes do erro.`);
        }
      } else {
        toast.success(
          totalRemoved === 1
            ? 'Classificação removida em lote.'
            : `${totalRemoved} classificações removidas em lote.`,
        );
      }

      try {
        await reconcileCurationSnapshot(optimistic, setActions, setSummary);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao remover classificações em lote.');
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

  async function saveAdminDelivery(values: ValidationFormValues): Promise<boolean> {
    const current = adminDeliveryCurrent;
    if (!current || isSavingAdminDelivery) return false;
    const savedId = current.id;
    const classification = current.assignment?.classification ?? '';
    const payload = {
      ...values,
      informedExecutedValue: resolveInformedExecutedValue({
        theme: current.theme,
        classification,
        deliveries: values.deliveries,
        informedExecutedValue: values.informedExecutedValue,
        // Categorias por percentual: valor executado = dotação inicial × ponderador (regra fixa).
        initialBudget: current.action?.totals?.initialBudget,
        weightingFactor: current.assignment?.weightingFactor,
      }),
    };
    setIsSavingAdminDelivery(true);
    try {
      await api(`/validations/${savedId}/admin`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setValidations((prev) =>
        prev.map((item) =>
          item.id === savedId
            ? {
                ...item,
                realizedDescription: payload.realizedDescription,
                informedExecutedValue: payload.informedExecutedValue,
                observations: payload.observations ?? '',
                deliveries: payload.deliveries.map((delivery) => ({
                  id: delivery.id,
                  name: delivery.name,
                  description: delivery.description,
                  quantity: delivery.quantity,
                  municipality: delivery.municipality,
                  beneficiaries: delivery.beneficiaries,
                  executedValue: delivery.executedValue,
                })),
              }
            : item,
        ),
      );
      adminDeliveryForm.reset(payload);
      toast.success(
        current.status === 'APROVADO'
          ? 'Entregas atualizadas.'
          : 'Entregas salvas. Clique em Finalizar para publicar nos resultados.',
      );
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar entregas.');
      return false;
    } finally {
      setIsSavingAdminDelivery(false);
    }
  }

  async function finalizeAdminDelivery(id: string) {
    if (isFinalizingAdminDelivery) return;
    setIsFinalizingAdminDelivery(true);
    try {
      await api(`/validations/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewerComment: 'Entregas inseridas pela SEPLAN.' }),
      });
      toast.success('Entregas finalizadas. Já constam em Resultados.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar entregas.');
    } finally {
      setIsFinalizingAdminDelivery(false);
    }
  }

  async function reopenAdminDelivery(id: string) {
    if (isFinalizingAdminDelivery) return;
    setIsFinalizingAdminDelivery(true);
    try {
      await api(`/validations/${id}/revert`, { method: 'POST' });
      toast.success('Registro reaberto para edição.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reabrir registro.');
    } finally {
      setIsFinalizingAdminDelivery(false);
    }
  }

  const columns = useMemo<ColumnDef<BudgetAction>[]>(
    () => [
      {
        id: 'expand',
        header: () => null,
        cell: ({ row }) => {
          const isExpanded = expandedActionId === row.original.id;
          return (
            <button
              type="button"
              aria-label={isExpanded ? 'Ocultar fontes' : 'Mostrar fontes'}
              aria-expanded={isExpanded}
              title={isExpanded ? 'Ocultar fontes' : 'Mostrar fontes'}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedActionId((current) => (current === row.original.id ? null : row.original.id));
              }}
            >
              {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
            </button>
          );
        },
      },
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
      {
        id: 'functionalProgram',
        accessorKey: 'functionalProgram',
        header: 'Função programática',
        enableHiding: true,
        filterFn: (row, _columnId, filterValue) =>
          functionalColumnFilterMatches(
            row.original,
            filterValue as FunctionalColumnFilterValue | undefined,
            allValue,
          ),
      },
    ],
    [expandedActionId],
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

    if (columnFilters.functionCode !== allValue || columnFilters.subfunctionCode !== allValue) {
      filters.push({
        id: 'functionalProgram',
        value: {
          functionCode: columnFilters.functionCode,
          subfunctionCode: columnFilters.subfunctionCode,
        },
      });
    }

    return filters;
  }, [
    columnFilters.application,
    columnFilters.functionCode,
    columnFilters.organizationCode,
    columnFilters.subfunctionCode,
    columnFilters.theme,
  ]);

  const handleColumnFiltersChange = useCallback(
    (nextFilters: ActionColumnFilters | ((current: ActionColumnFilters) => ActionColumnFilters)) => {
      setColumnFilters((currentFilters) => {
        const next = typeof nextFilters === 'function' ? nextFilters(currentFilters) : nextFilters;
        if (
          currentFilters.organizationCode === next.organizationCode &&
          currentFilters.application === next.application &&
          currentFilters.theme === next.theme &&
          currentFilters.functionCode === next.functionCode &&
          currentFilters.subfunctionCode === next.subfunctionCode
        ) {
          return currentFilters;
        }

        return next;
      });
    },
    [],
  );

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
      columnVisibility: { functionalProgram: false },
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
    return governmentStructure.organizations
      .map((org) => ({ code: org.code, name: org.name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [governmentStructure]);

  const relocatedUnitKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const org of governmentStructure.organizations) {
      for (const unit of org.units) {
        if (unit.relocated) keys.add(`${org.code}|${unit.code}`);
      }
    }
    return keys;
  }, [governmentStructure]);

  const years = useMemo(() => [...new Set(actions.map((action) => String(action.year)))].sort(), [actions]);

  const executedByAssignment = useMemo(
    () => buildVerifiedDeliveryExecutedMap(validations),
    [validations],
  );

  const themeGaugeData = useMemo(() => {
    const acc = new Map<ThemeBudget, { liquidated: number; planned: number }>();
    for (const action of actions) {
      const seen = new Set<ThemeBudget>();
      for (const asgn of action.assignments) {
        if (seen.has(asgn.theme)) continue;
        seen.add(asgn.theme);
        const contribution = thematicBudgetContribution({
          theme: asgn.theme,
          classification: asgn.classification,
          weightingFactor: asgn.weightingFactor,
          initialBudget: action.totals.initialBudget,
          liquidated: action.totals.liquidated,
          deliveryExecutedValue: executedByAssignment.get(asgn.id),
        });
        const entry = acc.get(asgn.theme) ?? { liquidated: 0, planned: 0 };
        entry.liquidated += contribution.liquidated;
        entry.planned += contribution.planned;
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
  }, [actions, executedByAssignment]);

  const axisReport = useMemo(
    () => buildAxisExecutionReport(actions, metadata, executedByAssignment),
    [actions, metadata, executedByAssignment],
  );

  const classificationReport = useMemo(
    () => buildClassificationExecutionReport(actions, metadata, executedByAssignment),
    [actions, metadata, executedByAssignment],
  );

  // Acompanhamento (progresso por exercício/órgão) e Revisão (ações sobre cada validação)
  // são a mesma lista de validations agrupada em dois níveis — unificadas em uma única memo.
  const validationsByYearOrg = useMemo(() => {
    const byYear = new Map<
      number,
      {
        year: number;
        total: number;
        byStatus: Record<string, number>;
        orgs: Map<
          string,
          { code: string; name: string; total: number; sent: number; byStatus: Record<string, number>; items: ValidationItem[] }
        >;
      }
    >();
    for (const v of validations) {
      const year = v.cycle?.year ?? v.action?.year ?? 0;
      let yearEntry = byYear.get(year);
      if (!yearEntry) {
        yearEntry = { year, total: 0, byStatus: { RASCUNHO: 0, ENVIADO: 0, DEVOLVIDO: 0, APROVADO: 0 }, orgs: new Map() };
        byYear.set(year, yearEntry);
      }
      yearEntry.total += 1;
      yearEntry.byStatus[v.status] = (yearEntry.byStatus[v.status] ?? 0) + 1;
      const code = v.organizationCode || v.action?.organizationCode || '—';
      let org = yearEntry.orgs.get(code);
      if (!org) {
        org = { code, name: v.action?.organizationName ?? code, total: 0, sent: 0, byStatus: { RASCUNHO: 0, ENVIADO: 0, DEVOLVIDO: 0, APROVADO: 0 }, items: [] };
        yearEntry.orgs.set(code, org);
      }
      org.total += 1;
      org.byStatus[v.status] = (org.byStatus[v.status] ?? 0) + 1;
      org.items.push(v);
      if (v.status === 'ENVIADO' || v.status === 'APROVADO') org.sent += 1;
    }
    return [...byYear.values()]
      .map((e) => ({ ...e, orgs: [...e.orgs.values()].sort((a, b) => a.code.localeCompare(b.code)) }))
      .sort((a, b) => b.year - a.year);
  }, [validations]);

  const approvedValidations = useMemo(
    () => validations.filter((v) => v.status === 'APROVADO'),
    [validations],
  );

  const municipalityDeliverySummaries = useMemo(
    () => ({
      ALL: aggregateApprovedDeliveriesByMunicipality(validations),
      OSG: aggregateApprovedDeliveriesByMunicipality(validations, 'OSG'),
      OCAD: aggregateApprovedDeliveriesByMunicipality(validations, 'OCAD'),
      CLIMATICO: aggregateApprovedDeliveriesByMunicipality(validations, 'CLIMATICO'),
    }),
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

  // O módulo de export (que embute a lib xlsx, pesada) é carregado sob demanda
  // no clique, para não entrar no bundle inicial da página.
  async function handleExportXlsx() {
    try {
      const { exportResultsXlsx, defaultExportFilename } = await import('@/lib/results-export');
      exportResultsXlsx(approvedValidations, defaultExportFilename('xlsx'));
      toast.success('Relatório XLSX exportado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar XLSX.');
    }
  }

  async function handleExportCsv() {
    try {
      const { buildResultsRows, exportResultsCsv, defaultExportFilename } = await import('@/lib/results-export');
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

  // Popula o formulário de curadoria com a classificação já gravada da ação
  // selecionada, refletindo o que foi definido (uma vez por par ação/tema).
  const lastSyncedAssignmentKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${selectedActionId}|${assignment.theme}`;
    if (lastSyncedAssignmentKeyRef.current === key) return;
    lastSyncedAssignmentKeyRef.current = key;
    if (!selectedActionId) return;
    const action = actions.find((a) => a.id === selectedActionId);
    const existing = action?.assignments.find((a) => a.theme === assignment.theme);
    setAssignment((prev) => ({
      ...prev,
      axis: existing?.axis ?? '',
      classification: existing?.classification ?? '',
      weightingFactor: existing?.weightingFactor != null ? String(existing.weightingFactor) : '',
      justification: existing?.justification ?? '',
    }));
  }, [selectedActionId, assignment.theme, actions]);

  const handleCurationSelectAction = useCallback((id: string) => {
    setSelectedActionId(id);
    setAssignment((current) => ({ ...current, actionId: id }));
  }, []);

  const handleCurationAssignmentChange = useCallback((next: AssignmentForm) => {
    setAssignment((current) => ({ ...current, ...next }));
  }, []);

  const filteredActionCount = table.getFilteredRowModel().rows.length;
  const organizationCount = governmentStructure.organizations.length;
  const catalogUnitCount = governmentStructure.organizations.reduce((s, o) => s + o.units.length, 0);
  // Com vários exercícios há um VIGENTE por ano: sem o recorte, o `find` devolveria
  // um qualquer e o cabeçalho de dados poderia apontar para outro exercício.
  const vigenteImport = useMemo(
    () => importHistory.find((imp) => imp.status === 'VIGENTE' && (loadedYear == null || imp.year === loadedYear)),
    [importHistory, loadedYear],
  );
  const unitCount = uniqueBy(actions, (action) => `${action.organizationCode}-${action.unitCode}`).length;
  const expenseLineCount = actions.reduce((total, action) => total + (action.expenseLinesCount ?? action.expenseLines?.length ?? 0), 0);

  // Entregas e validações existem só no exercício corrente. Quando o seletor está em
  // outro exercício, a tela vira consulta — e diz por quê, em vez de aparecer vazia.
  const offCurrentExercise =
    loadedYear != null && metadata?.currentYear != null && loadedYear !== metadata.currentYear;
  const offCurrentNotice = offCurrentExercise ? (
    <Alert>
      <ClipboardCheckIcon />
      <AlertDescription>
        Você está no exercício <span className="font-medium tabular-nums">{loadedYear}</span>, e as
        entregas pertencem ao exercício corrente (
        <span className="font-medium tabular-nums">{metadata?.currentYear}</span>). Esta tela está
        em modo de consulta — para preencher ou revisar, volte ao exercício corrente no seletor do
        cabeçalho.
      </AlertDescription>
    </Alert>
  ) : null;

  const navItems: AdminSidebarNavItem[] = [
    { id: 'overview', label: 'Visão geral', icon: GaugeIcon },
    { id: 'structure', label: 'Estrutura vigente', icon: DatabaseIcon, badge: actions.length },
    { id: 'curation', label: 'Curadoria temática', icon: FolderCogIcon, badge: summary?.assignments ?? 0 },
    { id: 'review', label: 'Acompanhamento e Revisão', icon: ClipboardCheckIcon, badge: validations.filter((v) => v.status === 'ENVIADO').length },
    { id: 'results', label: 'Resultados', icon: FileBarChart2Icon, badge: approvedValidations.length },
    { id: 'reports', label: 'Informações Gerais', icon: BarChart3Icon },
    { id: 'entregas', label: 'Inserir Entregas', icon: PackageIcon, badge: validations.length },
  ];
  const navItemById = (id: SectionId) => navItems.find((item) => item.id === id)!;

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
          <AdminSidebarNavigation
            groups={[
              { label: 'Painel', items: [navItemById('overview'), navItemById('reports')] },
              { label: 'Dados e curadoria', items: [navItemById('structure'), navItemById('curation')] },
              { label: 'Valida\u00e7\u00e3o', items: [navItemById('entregas'), navItemById('review'), navItemById('results')] },
            ]}
            activeSection={activeSection}
            onSelect={setActiveSection}
          />
        </SidebarContent>
        <div className="mx-3 h-px shrink-0 bg-sidebar-border" aria-hidden="true" />
        <SidebarFooter className="[--sidebar:oklch(0.97_0.005_165)] [--sidebar-foreground:oklch(0.25_0.04_165)] [--sidebar-accent:oklch(0.90_0.02_165)] [--sidebar-accent-foreground:oklch(0.18_0.05_165)] [--sidebar-border:oklch(0.85_0.03_165)]">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Monitoramento da execução orçamentária"
                onClick={() => router.push('/orcamento')}
              >
                <CoinsIcon />
                <span>Execução orçamentária</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
        <header className="sticky top-0 z-30 shrink-0 border-b border-black bg-green-900 text-white shadow-sm">
          <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6 2xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger size="icon-lg" className="size-10 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground [&_svg]:size-8" />
              <img src="/logo.svg" alt="Logo" className="h-8 w-auto shrink-0" />
              <span className="hidden text-xl font-semibold uppercase tracking-widest text-primary-foreground/50 select-none lg:inline">|</span>
              <span className="hidden truncate font-semibold uppercase tracking-widest lg:inline" style={{ fontSize: '22px' }}>Orçamentos Temáticos</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ExerciseSelect
                exercises={metadata?.exercises ?? []}
                year={loadedYear ?? year}
                onChange={setYear}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="border-border/60 bg-white text-foreground hover:bg-white/90 aria-expanded:bg-white">
                    <EyeIcon data-icon="inline-start" />
                    <span className="hidden lg:inline">Visualizar telas</span>
                    <ChevronDownIcon className="ml-1 hidden size-4 opacity-70 lg:inline" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-72 p-2">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Pré-visualizar como
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open('/secretaria?preview=representante', '_blank', 'noopener')}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FolderCogIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block font-medium">Secretaria (Representante)</span>
                      <span className="block text-xs text-muted-foreground">Curadoria temática e validação de entregas</span>
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="border-border/60 bg-white text-foreground hover:bg-white/90 aria-expanded:bg-white">
                    <BookOpenIcon data-icon="inline-start" />
                    <span className="hidden lg:inline">Legislação</span>
                    <ChevronDownIcon className="ml-1 hidden size-4 opacity-70 lg:inline" />
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
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <span>{item.label}</span>
                      <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </PopoverContent>
              </Popover>
              <Button
                variant="secondary"
                className="hidden border-border/60 bg-white text-foreground hover:bg-white/90 lg:inline-flex"
                onClick={() => void load()}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Atualizar
              </Button>
              <Button
                className="hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:inline-flex"
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <OverviewScheduledActionsPanel
                actions={actions}
                organizations={organizations}
                relocatedUnitKeys={relocatedUnitKeys}
                vigenteImport={vigenteImport}
              />
            </div>
          ) : null}

          {activeSection === 'structure' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <Tabs value={structureSubTab} onValueChange={setStructureSubTab} className="flex flex-col gap-5">
                <HoverTabsList
                  activeValue={structureSubTab}
                  items={[
                    { value: 'base', content: 'Base vigente' },
                    { value: 'exercises', content: 'Exercícios' },
                    { value: 'executors', content: 'Atribuição de execução' },
                    { value: 'users', content: 'Usuários' },
                    { value: 'duplicates', content: 'Unidades duplicadas' },
                    { value: 'reconciliation', content: 'Conferência com QDD' },
                  ]}
                />

                <TabsContent value="exercises">
                  <ExercisesPanel
                    exercises={metadata?.exercises ?? []}
                    onChanged={() =>
                      load().catch((err: unknown) => {
                        toast.error(
                          err instanceof Error ? err.message : 'Erro ao recarregar os exercícios.',
                        );
                      })
                    }
                  />
                </TabsContent>

                <TabsContent value="users">
                  <UsersPanel organizations={governmentStructure.organizations} />
                </TabsContent>

                <TabsContent value="duplicates">
                  <RelocatedUnitsPanel
                    structure={governmentStructure}
                    year={loadedYear}
                    onChanged={async () => {
                      // O refetch precisa do mesmo exercício: sem ele, uma gravação
                      // fora do corrente era seguida da recarga do corrente e o painel
                      // parecia não ter feito nada.
                      const govStructure = await api<GovernmentStructure>(
                        `/government-structure${exerciseQuery(requestedYear)}`,
                      ).catch(() => ({ organizations: [] }));
                      setGovernmentStructure(govStructure);
                    }}
                  />
                </TabsContent>

                <TabsContent value="reconciliation">
                  <QddStructureReconciliationPanel
                    detectedYear={preview?.detectedYear}
                    detectedYearFrom={preview?.yearDetectedFrom}
                    diff={structureDiff}
                    source={preview ? 'preview' : 'vigente'}
                    previewId={preview?.previewId}
                    hasQddSource={Boolean(preview) || actions.length > 0}
                    onApplied={async () => {
                      const q = exerciseQuery(requestedYear);
                      const [govStructure, executionData] = await Promise.all([
                        api<GovernmentStructure>(`/government-structure${q}`),
                        api<ExecutionStructure>(`/execution/structure${q}`).catch(() => ({ organizations: [] })),
                      ]);
                      setGovernmentStructure(govStructure);
                      setExecutionStructure(executionData);
                      const src = preview ? 'preview' : 'vigente';
                      await loadStructureDiff(src, preview?.previewId);
                    }}
                  />
                </TabsContent>

                <TabsContent value="base" className="flex flex-col gap-5">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumo da base</CardTitle>
                      <CardDescription>
                        Indicadores do cadastro de estrutura e da programação do QDD vigente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: 'Órgãos (cadastro)', value: organizationCount },
                          { label: 'Unidades (cadastro)', value: catalogUnitCount },
                          { label: 'Ações (QDD)', value: actions.length },
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

                  <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                    <Card>
                      <CardHeader>
                        <CardTitle>Importar QDD</CardTitle>
                        <CardDescription>
                          Envie uma nova versão oficial para substituir a base vigente. A prévia pode ser conferida na aba
                          Conferência com QDD antes de confirmar.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <FieldGroup>
                          <Field>
                            <FieldLabel>Exercício</FieldLabel>
                            <Select
                              value={selectedImportYear == null ? undefined : String(selectedImportYear)}
                              onValueChange={(v) => setSelectedImportYear(Number(v))}
                            >
                              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o exercício" /></SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {IMPORT_YEAR_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={String(option)}>
                                      <span className="tabular-nums">{option}</span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
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
                          <Field>
                            <FieldLabel>
                              {selectedPeriodType === 'ACUMULADO_ANUAL' ? 'Mês de referência (até)' : 'Mês de referência'}
                            </FieldLabel>
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
                        </FieldGroup>
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                          <div className="flex-1 min-w-40">
                            <span className="block text-sm font-medium text-foreground">Coleta automática do SICAF</span>
                            <span className="block text-xs text-muted-foreground">
                              Puxa o QDD "Saldo Retroativo" direto do SICAF — sem exportar nem enviar arquivo.
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isTriggeringSicaf || isPreviewingImport || isConfirmingImport}
                            onClick={() => void triggerSicafCollection()}
                          >
                            {isTriggeringSicaf ? (
                              <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
                            ) : (
                              <RefreshCwIcon data-icon="inline-start" />
                            )}
                            Puxar QDD do SICAF agora
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isTriggeringSicaf}
                            onClick={() => void loadSicafPending()}
                          >
                            Verificar prévia
                          </Button>
                        </div>
                        {sicafPending && preview?.previewId !== sicafPending.previewId ? (
                          <Alert className="border-primary/25 bg-primary/5">
                            <FileSpreadsheetIcon />
                            <AlertDescription>
                              <span className="block font-medium text-foreground">
                                Prévia do SICAF pronta (exercício {sicafPending.year})
                              </span>
                              <span className="block">
                                Coleta automática · {sicafPending.actionCount} ações, {sicafPending.organizationsCount} órgãos
                                {sicafPending.generatedAt
                                  ? ` · gerada em ${new Date(sicafPending.generatedAt).toLocaleString('pt-BR')}`
                                  : ''}
                                . Não precisa exportar nem enviar o arquivo — revise e confirme.
                              </span>
                              {/* Nunca abrir uma prévia num exercício diferente do que está na tela:
                                  a conferência derivaria o ano da própria prévia e misturaria
                                  cadastros de exercícios distintos (ver CLAUDE.md). Trocar primeiro. */}
                              {loadedYear != null && sicafPending.year !== loadedYear ? (
                                <>
                                  <span className="mt-2 block text-muted-foreground">
                                    A tela está no exercício {loadedYear}. Troque para o {sicafPending.year} para revisar.
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    disabled={isPreviewingImport || isConfirmingImport}
                                    onClick={() => setYear(sicafPending.year)}
                                  >
                                    Ir para o exercício {sicafPending.year}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  disabled={isOpeningSicaf || isPreviewingImport || isConfirmingImport}
                                  onClick={() => void openSicafPreview()}
                                >
                                  {isOpeningSicaf ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : null}
                                  Revisar prévia do SICAF
                                </Button>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : null}
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
                              <span className="block font-medium text-foreground">Prévia: {preview.filename}</span>
                              <span className="block">
                                Exercício: <span className="font-semibold tabular-nums">{preview.year}</span>
                                {preview.yearDetectedFrom === 'manual'
                                  ? ' (escolhido no formulário)'
                                  : preview.yearDetectedFrom === 'header'
                                    ? ' (lido do cabeçalho da planilha)'
                                    : preview.yearDetectedFrom === 'filename'
                                      ? ' (lido do nome do arquivo)'
                                      : preview.yearDetectedFrom === 'fallback'
                                        ? ' — não localizado no arquivo, assumido o ano atual. Confira antes de confirmar.'
                                        : ''}
                              </span>
                              {preview.detectedYear != null &&
                              preview.detectedYear !== preview.year &&
                              preview.detectedYearFrom !== 'fallback' ? (
                                <span className="block font-medium text-destructive">
                                  Atenção: o arquivo declara o exercício {preview.detectedYear}
                                  {preview.detectedYearFrom === 'header'
                                    ? ' no cabeçalho da planilha'
                                    : ' no nome do arquivo'}
                                  , diferente do escolhido. Confirme se o arquivo é o certo antes de
                                  registrar.
                                </span>
                              ) : null}
                              <span className="block">Período: {formatPeriod(preview.referenceMonth, preview.year, preview.periodType)}</span>
                              <span className="block">
                                {preview.rowCount.toLocaleString('pt-BR')} linhas · {preview.actionCount.toLocaleString('pt-BR')} ações ·{' '}
                                {preview.organizationsCount.toLocaleString('pt-BR')} órgãos
                              </span>
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
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-primary"
                              checked={importComparisonOnly}
                              onChange={(event) => setImportComparisonOnly(event.target.checked)}
                              disabled={isConfirmingImport}
                            />
                            <span>
                              <span className="block font-medium">Exercício apenas para comparação</span>
                              <span className="block text-xs text-muted-foreground">
                                Recebe execução e marcações temáticas, mas não gera ciclos de validação
                                nem entregas das secretarias. Define a política do exercício {preview.year} na
                                primeira importação.
                              </span>
                            </span>
                          </label>
                        ) : null}
                        {preview ? (
                          <Button disabled={isConfirmingImport || isPreviewingImport} onClick={() => void confirmImport()}>
                            {isConfirmingImport ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <CheckCircle2Icon data-icon="inline-start" />}
                            {isConfirmingImport ? 'Registrando QDD...' : 'Confirmar e registrar QDD'}
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>QDD vigente</CardTitle>
                        <CardDescription>Arquivo oficial em uso na programação e nos relatórios.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {vigenteImport ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>Vigente</Badge>
                              <span className="text-lg font-semibold">
                                {formatPeriod(vigenteImport.referenceMonth, vigenteImport.year, vigenteImport.periodType)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {vigenteImport.periodType === 'ACUMULADO_ANUAL' ? 'Acumulado anual' : 'Mês isolado'}
                              </span>
                            </div>
                            <dl className="grid gap-3 text-sm">
                              <div>
                                <dt className="text-xs text-muted-foreground">Arquivo</dt>
                                <dd className="truncate font-medium" title={vigenteImport.filename}>
                                  {vigenteImport.filename}
                                </dd>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <dt className="text-xs text-muted-foreground">Ações</dt>
                                  <dd className="font-semibold tabular-nums">{vigenteImport.actionCount.toLocaleString('pt-BR')}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-muted-foreground">Linhas</dt>
                                  <dd className="font-semibold tabular-nums">{vigenteImport.rowCount.toLocaleString('pt-BR')}</dd>
                                </div>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">Registrado em</dt>
                                <dd>{new Date(vigenteImport.importedAt).toLocaleString('pt-BR')}</dd>
                              </div>
                            </dl>
                          </div>
                        ) : (
                          <Empty className="border-none p-0">
                            <EmptyHeader>
                              <EmptyMedia>
                                <FileSpreadsheetIcon />
                              </EmptyMedia>
                            </EmptyHeader>
                            <EmptyTitle>Nenhum QDD vigente</EmptyTitle>
                            <EmptyDescription>Importe o primeiro arquivo ao lado para iniciar a base.</EmptyDescription>
                          </Empty>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <CardTitle>Histórico de importações</CardTitle>
                        <CardDescription>{importHistory.length} QDD{importHistory.length !== 1 ? 's' : ''} registrado{importHistory.length !== 1 ? 's' : ''}.</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={isReattaching}
                        title="Religa classificações órfãs de QDDs anteriores às ações do QDD vigente"
                        onClick={() => void reattachAssignments()}
                      >
                        {isReattaching ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <RefreshCwIcon data-icon="inline-start" />}
                        {isReattaching ? 'Recuperando...' : 'Recuperar marcações'}
                      </Button>
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
                                  {/* O exercício vem junto do selo porque há um vigente por ano. */}
                                  <Badge variant="outline" className="shrink-0 tabular-nums">
                                    Exercício {imp.year}
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

                <TabsContent value="executors">
                  <ExecutionAssignmentCard
                    structure={executionStructure}
                    year={loadedYear}
                    onChanged={() =>
                      load().catch((err) => {
                        toast.error(err instanceof Error ? err.message : 'Erro ao recarregar.');
                      })
                    }
                  />
                </TabsContent>
              </Tabs>
            </section>
          ) : null}

          {activeSection === 'curation' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <ThematicCurationPanel
                actions={actions}
                metadata={metadata}
                organizations={governmentStructure.organizations}
                selectedActionId={selectedActionId}
                onSelectActionId={handleCurationSelectAction}
                expandedActionId={expandedActionId}
                onExpandActionId={setExpandedActionId}
                assignment={assignment}
                onAssignmentChange={handleCurationAssignmentChange}
                selectedActionHasTheme={selectedActionHasTheme}
                isRemovingAssignment={isRemovingAssignment}
                removePopoverOpen={removePopoverOpen}
                onRemovePopoverOpenChange={setRemovePopoverOpen}
                assignmentIdsPendingRemoval={assignmentIdsPendingRemoval}
                onAssignmentIdsPendingRemovalChange={setAssignmentIdsPendingRemoval}
                onCreateAssignment={createAssignment}
                onUpdateAssignment={updateAssignment}
                onConfirmRemoveAssignment={confirmRemoveAssignment}
                bulkRemoveEnabled
                onConfirmBulkRemove={confirmBulkRemoveAssignments}
              />
            </div>
          ) : null}

          {activeSection === 'entregas' && offCurrentNotice ? (
            <div className="mb-4">{offCurrentNotice}</div>
          ) : null}

          {activeSection === 'entregas' ? (
            <AdminDeliveryWorkspace
              validations={validations}
              selectedId={adminDeliveryId}
              current={adminDeliveryCurrent}
              classificationLabel={
                adminDeliveryCurrent
                  ? metadata?.classifications[adminDeliveryCurrent.theme]?.find(
                      (option) => option.value === adminDeliveryCurrent.assignment?.classification,
                    )?.label
                  : undefined
              }
              onSelect={setAdminDeliveryId}
              form={adminDeliveryForm}
              deliveries={adminDeliveries}
              onSave={saveAdminDelivery}
              onFinalize={finalizeAdminDelivery}
              onReopen={reopenAdminDelivery}
              isSaving={isSavingAdminDelivery}
              isFinalizing={isFinalizingAdminDelivery}
            />
          ) : null}

          {activeSection === 'review' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              {offCurrentNotice}
              {validationsByYearOrg.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><SendIcon /></EmptyMedia>
                    <EmptyTitle>Sem dados de validação</EmptyTitle>
                    <EmptyDescription>Assim que as secretarias classificarem ações, o acompanhamento e a revisão aparecerão aqui.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                validationsByYearOrg.map((year) => {
                  const orgsSent = year.orgs.filter((o) => o.sent > 0).length;
                  const defaultOpen = year.orgs
                    .filter((o) => (o.byStatus['ENVIADO'] ?? 0) > 0)
                    .map((o) => `${year.year}-${o.code}`);
                  return (
                    <Card key={year.year}>
                      <CardHeader>
                        <CardTitle>Exercício {year.year}</CardTitle>
                        <CardDescription>
                          {orgsSent} de {year.orgs.length} secretaria{year.orgs.length !== 1 ? 's' : ''} já enviaram informações — {year.total} validaç{year.total !== 1 ? 'ões' : 'ão'} no total.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                          {(['RASCUNHO', 'ENVIADO', 'APROVADO'] as const).map((status) => (
                            <div key={status} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                              <StatusBadge status={status} />
                              <span className="text-lg font-semibold">{displayStatusCount(year.byStatus, status)}</span>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <Accordion type="multiple" defaultValue={defaultOpen} className="flex flex-col gap-3">
                          {year.orgs.map((org) => {
                            const pending = org.byStatus['ENVIADO'] ?? 0;
                            return (
                              <AccordionItem key={org.code} value={`${year.year}-${org.code}`}>
                                <AccordionTrigger>
                                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold leading-snug">{org.code} - {org.name}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {org.sent} de {org.total} enviada{org.total !== 1 ? 's' : ''}
                                        {pending > 0 ? ` · ${pending} pendente${pending !== 1 ? 's' : ''} de revisão` : ''}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {pending > 0 ? (
                                        <Badge className="bg-primary text-primary-foreground">{pending} a revisar</Badge>
                                      ) : null}
                                      {(['RASCUNHO', 'ENVIADO', 'APROVADO'] as const)
                                        .filter((s) => displayStatusCount(org.byStatus, s) > 0)
                                        .map((s) => (
                                          <span key={s} className="flex items-center gap-1.5 text-xs">
                                            <StatusBadge status={s} />
                                            <span className="font-semibold tabular-nums">{displayStatusCount(org.byStatus, s)}</span>
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
                                    <Card key={validation.id} size="sm" className="overflow-hidden bg-card">
                                      <CardHeader>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <ThemeBadge
                                            theme={validation.theme}
                                            className={
                                              validation.theme === 'OSG'
                                                ? '!border-violet-100 !bg-violet-100 !text-violet-950'
                                                : validation.theme === 'OCAD'
                                                  ? '!border-cyan-100 !bg-cyan-100 !text-cyan-950'
                                                  : '!border-emerald-100 !bg-emerald-100 !text-emerald-950'
                                            }
                                          />
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
                                            className="!border-white/75 !bg-white !text-green-950 hover:!bg-white/90 hover:!text-green-950 disabled:!border-white/75 disabled:!bg-white disabled:!text-green-950/45 disabled:!opacity-100"
                                            disabled={validation.status !== 'ENVIADO'}
                                            onClick={() => void reviewValidation(validation.id, 'approve')}
                                          >
                                            <CheckCircle2Icon data-icon="inline-start" />
                                            Aprovar
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            className="!border-red-100 !bg-white !text-red-700 hover:!bg-red-50 hover:!text-red-800 disabled:!border-white/75 disabled:!bg-white disabled:!text-red-700/45 disabled:!opacity-100"
                                            disabled={validation.status !== 'ENVIADO'}
                                            onClick={() => void reviewValidation(validation.id, 'return')}
                                          >
                                            <RotateCcwIcon data-icon="inline-start" />
                                            Devolver
                                          </Button>
                                          <Button
                                            variant="outline"
                                            className="!border-white/75 !bg-white !text-green-950 hover:!bg-white/90 hover:!text-green-950 disabled:!border-white/75 disabled:!bg-white disabled:!text-green-950/45 disabled:!opacity-100"
                                            disabled={validation.status !== 'APROVADO'}
                                            onClick={() => void revertApproval(validation.id)}
                                          >
                                            <RotateCcwIcon data-icon="inline-start" />
                                            Reverter aprovação
                                          </Button>
                                        </CardAction>
                                      </CardHeader>
                                      <CardContent className="flex flex-col gap-3">
                                        <div className="grid overflow-hidden rounded-lg bg-muted/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-border/30">
                                          <div className="min-w-0 px-3 py-2.5">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Entregas</p>
                                            <p className="mt-1 text-base font-semibold tabular-nums">{deliveriesCount}</p>
                                          </div>
                                          <div className="min-w-0 border-t border-border/30 px-3 py-2.5 sm:border-t-0">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Valor executado</p>
                                            <p className="mt-1 text-base font-semibold tabular-nums">
                                              {hasExecValue ? formatMoney(validation.informedExecutedValue!) : '—'}
                                            </p>
                                          </div>
                                          <div className="min-w-0 border-t border-border/30 px-3 py-2.5 sm:border-t-0" title={municipalities.join(', ')}>
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Municípios</p>
                                            <p className="mt-1 truncate text-base font-semibold">{municipalitiesLabel}</p>
                                          </div>
                                        </div>
                                        {validation.realizedDescription ? (
                                          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Descrição informada</p>
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
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </section>
          ) : null}

          {activeSection === 'results' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <Card>
                <CardHeader className="bg-transparent text-card-foreground [&_[data-slot=card-title]]:text-card-foreground [&_[data-slot=card-description]]:text-muted-foreground">
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
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
                          <span className="flex-1 text-left">XLSX</span>
                          <span className="text-xs text-muted-foreground">Planilha</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted hover:text-foreground transition-colors"
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

              <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
                <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
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
                </div>

                <aside className="order-1 min-w-0 xl:sticky xl:top-4 xl:order-2" aria-label="Mapa de entregas por município">
                  <AcreDeliveriesMap summaries={municipalityDeliverySummaries} />
                </aside>
              </div>
            </section>
          ) : null}

          {activeSection === 'reports' ? (
            <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
              <Tabs
                value={reportsViewTab}
                onValueChange={(value) => setReportsViewTab(value as 'overview' | 'by-axis')}
                className="min-h-0 flex-1 outline-none"
                role="group"
                aria-label="Informações Gerais — use as setas do teclado para alternar entre Visão geral e Execução por eixo"
              >
                <TabsContent value="overview" forceMount className="mt-5 flex flex-col gap-5">
                  <Card >
                    <CardHeader>
                      <CardTitle>Execução dos orçamentos temáticos</CardTitle>
                      <CardDescription>Percentual de execução por tema — liquidado sobre a dotação inicial.</CardDescription>
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
                            <div className="flex w-max min-w-[220px] max-w-full flex-col items-center gap-0.5 px-1 text-center">
                              <p className="text-sm font-semibold leading-none">{key}</p>
                              <p className="max-w-[220px] text-xs text-muted-foreground leading-snug">{label}</p>
                              <p className="mt-1 max-w-full overflow-x-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                                {formatMoney(liquidated)} / {formatMoney(planned)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
                    <Card className="flex h-full flex-col">
                      <CardHeader>
                        <CardTitle>Resumo por tema</CardTitle>
                        <CardDescription>Valores liquidados das ações classificadas por orçamento temático.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col">
                        <ThemeLiquidatedSummaryChart data={summary?.totalsByTheme ?? []} />
                      </CardContent>
                    </Card>

                    <Card className="flex h-full flex-col">
                      <CardHeader>
                        <CardTitle>Resumo por classificação</CardTitle>
                        <CardDescription>Valores liquidados por classificação dentro de cada orçamento temático.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col">
                        <ClassificationLiquidatedSummaryChart data={summary?.totalsByClassification ?? []} />
                      </CardContent>
                    </Card>

                    <Card className="flex h-full flex-col">
                      <CardHeader>
                        <CardTitle>Status das validações</CardTitle>
                        <CardDescription>Distribuição atual dos formulários enviados às secretarias.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
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

                <TabsContent value="by-axis" forceMount className="mt-5">
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
                        <HoverTabsList
                          activeValue={reportsThemeTab}
                          className="w-fit"
                          items={(['OCAD', 'OSG', 'CLIMATICO'] as const).map((theme) => {
                            const tabTotals = themeAxisTotals(axisReport, theme, actions);
                            return {
                              value: theme,
                              className: 'gap-1.5',
                              content: (
                                <>
                                  {themeLabels[theme]}
                                  {tabTotals.actionsCount > 0 ? (
                                    <span
                                      className="size-1.5 shrink-0 rounded-full bg-primary"
                                      aria-hidden
                                    />
                                  ) : null}
                                </>
                              ),
                            };
                          })}
                        />
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

                <div className="sticky bottom-0 z-10 mt-2 flex items-center justify-between gap-4 border-t bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Seção anterior"
                    aria-disabled={reportsViewTab === 'overview'}
                    className={cn(reportsViewTab === 'overview' && 'pointer-events-none opacity-40')}
                    onClick={() => setReportsViewTab('overview')}
                  >
                    <ChevronLeftIcon data-icon="inline-start" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-2" role="tablist" aria-label="Seções de Informações Gerais">
                    {REPORTS_VIEW_ITEMS.map((item) => {
                      const active = reportsViewTab === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-label={item.label}
                          onClick={() => setReportsViewTab(item.value)}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 ease-out',
                            active
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    size="sm"
                    aria-label="Próxima seção"
                    aria-disabled={reportsViewTab === 'by-axis'}
                    className={cn(reportsViewTab === 'by-axis' && 'pointer-events-none opacity-40')}
                    onClick={() => setReportsViewTab('by-axis')}
                  >
                    Próximo
                    <ChevronRightIcon data-icon="inline-end" />
                  </Button>
                </div>
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
  actions,
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
  expandedActionId,
}: {
  title: string;
  description: string;
  table: ReturnType<typeof useReactTable<BudgetAction>>;
  actions: BudgetAction[];
  organizations: { code: string; name: string }[];
  themeSummary: { theme: ThemeBudget; actions: number; liquidated: number }[];
  qddStats: { organizationCount: number; unitCount: number; expenseLineCount: number; actionCount: number };
  onOpenStructure: () => void;
  columnFilters: ActionColumnFilters;
  onColumnFiltersChange: (filters: ActionColumnFilters | ((current: ActionColumnFilters) => ActionColumnFilters)) => void;
  themePopoverOpen: boolean;
  onThemePopoverOpenChange: (open: boolean) => void;
  qddPopoverOpen: boolean;
  onQddPopoverOpenChange: (open: boolean) => void;
  expandedActionId: string | null;
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
          <FunctionalClassificationFilters
            actions={actions}
            functionFilter={columnFilters.functionCode}
            subfunctionFilter={columnFilters.subfunctionCode}
            onFunctionChange={(value) =>
              onColumnFiltersChange((current) => ({
                ...current,
                functionCode: value,
                subfunctionCode: allValue,
              }))
            }
            onSubfunctionChange={(value) =>
              onColumnFiltersChange((current) => ({
                ...current,
                subfunctionCode: value,
              }))
            }
            allValue={allValue}
            className="w-44"
          />
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
              {table.getRowModel().rows.map((row) => {
                const isExpanded = expandedActionId === row.original.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-1.5 leading-tight whitespace-normal align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded ? (
                      <TableRow>
                        <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/20 p-3">
                          <SourceBreakdownTable action={row.original} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
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
  return (
    <SearchableCombobox
      className={className}
      value={value}
      onChange={onChange}
      placeholder="Todos os órgãos"
      items={[
        { value: allValue, label: 'Todos os órgãos' },
        ...organizations.map((o) => ({
          value: o.code,
          label: `${o.code} - ${o.name}`,
        })),
      ]}
    />
  );
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

/**
 * `useExercise` lê `useSearchParams`, que exige um limite de Suspense — sem ele o
 * `next build` falha ao pré-renderizar a rota.
 */
export default function SeplanPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-white" />}>
      <SeplanPageContent />
    </Suspense>
  );
}
