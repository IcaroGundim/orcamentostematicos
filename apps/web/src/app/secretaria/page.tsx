'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileCheck2Icon,
  ChevronRightIcon,
  FolderCogIcon,
  InfoIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, SummaryCountBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { ThematicCurationPanel } from '@/components/domain/thematic-curation-panel';
import { SourceBreakdownTable } from '@/components/domain/source-breakdown-table';
import { FunctionalProgramLine } from '@/components/domain/functional-program-line';
import { SecretariaBulkActions } from '@/components/domain/secretaria-bulk-actions';
import { SecretariaOnboardingSlides } from '@/components/domain/secretaria-onboarding-slides';
import { ValidationForm } from '@/components/domain/validation-form';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels } from '@/lib/api';
import {
  isWeightingFactorLocked,
  lockedWeightingFactorLabel,
  resolveInformedExecutedValue,
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
  clearAllValidationDrafts,
  clearValidationDraft,
  getValidationDraft,
  setValidationDraft,
} from '@/lib/validation-draft-cache';
import {
  collectPendingValidationIssues,
  emptyValidationFormValues,
  toValidationFormInput,
  validationFormSchema,
  type ValidationFormInput,
  type ValidationFormValues,
  type ValidationSubmitIssue,
} from '@/lib/validation-schema';
import type { BudgetAction, Metadata, Organization, Summary, ThematicAssignment, ThemeBudget, ValidationItem } from '@/types/domain';

type FormInput = ValidationFormInput;
type FormValues = ValidationFormValues;

const initialAssignment = {
  theme: 'OSG' as ThemeBudget,
  axis: '',
  classification: '',
  weightingFactor: '',
  justification: '',
};

export default function SecretariaPage() {
  const router = useRouter();
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [selectedActionId, setSelectedActionId] = useState('');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [removePopoverOpen, setRemovePopoverOpen] = useState(false);
  const [assignmentIdsPendingRemoval, setAssignmentIdsPendingRemoval] = useState<string[]>([]);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [submitIssues, setSubmitIssues] = useState<ValidationSubmitIssue[]>([]);
  const [submitIssuesOpen, setSubmitIssuesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('apresentacao');
  const [userRole, setUserRole] = useState<string>('');
  const [organizationName, setOrganizationName] = useState('');
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const isPreview = previewRole !== null;
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const prevCurrentIdRef = useRef<string | null>(null);
  const currentIdRef = useRef<string>('');
  const current = useMemo(() => validations.find((item) => item.id === currentId) ?? validations[0], [validations, currentId]);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(validationFormSchema),
    defaultValues: emptyValidationFormValues(),
  });
  const deliveries = useFieldArray({ control: form.control, name: 'deliveries' });

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const previewParam = new URLSearchParams(window.location.search).get('preview');
    const isAdmin = session.user.role === 'SEPLAN_ADMIN';

    let effectiveRole = session.user.role;
    if (isAdmin && previewParam) {
      effectiveRole = 'SECRETARIA_REPRESENTANTE';
      setPreviewRole(effectiveRole);
    } else if (session.user.role !== 'SECRETARIA_REPRESENTANTE') {
      router.push('/seplan');
      return;
    }

    setUserRole(effectiveRole);
    load().catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados. O servidor pode estar indisponível.');
    });
  }, [router]);

  useEffect(() => {
    if (!currentId) return;
    const validation = validations.find((item) => item.id === currentId);
    if (!validation) return;

    if (prevCurrentIdRef.current !== currentId) {
      if (prevCurrentIdRef.current) {
        setValidationDraft(prevCurrentIdRef.current, form.getValues());
      }
      const cached = getValidationDraft(currentId);
      form.reset(cached ?? toValidationFormInput(validation));
      prevCurrentIdRef.current = currentId;
    }
  }, [currentId, validations, form]);

  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  useEffect(() => {
    setSubmitIssues([]);
    setSubmitIssuesOpen(false);
  }, [currentId]);

  async function load() {
    const [validationData, meta, actionData, summaryData, orgs] = await Promise.all([
      api<ValidationItem[]>('/validations/my'),
      api<Metadata>('/metadata'),
      api<BudgetAction[]>('/budget-actions'),
      api<Summary>('/reports/summary'),
      api<Organization[]>('/organizations'),
    ]);

    setValidations(validationData);
    setMetadata(meta);
    setActions(actionData);
    setSummary(summaryData);

    const session = getStoredSession();
    const org = orgs.find((o) => o.code === session?.user.organizationCode);
    setOrganizationName(org?.name ?? actionData[0]?.organizationName ?? '');
    setCurrentId((id) => id || validationData[0]?.id || '');
    setSelectedActionId((id) => id || actionData[0]?.id || '');
  }

  function blockPreviewAction() {
    if (isPreview) {
      toast.info('Ação desabilitada no modo de pré-visualização.');
      return true;
    }
    return false;
  }

  function signOut() {
    if (isPreview) {
      router.push('/seplan');
      return;
    }
    if (isSigningOut) return;
    setIsSigningOut(true);
    clearStoredSession();
    router.push('/login');
  }

  function toDraftPayload(values: FormValues) {
    if (!current) return values;
    const classification = current.assignment?.classification ?? '';
    return {
      ...values,
      informedExecutedValue: resolveInformedExecutedValue({
        theme: current.theme,
        classification,
        deliveries: values.deliveries,
        informedExecutedValue: values.informedExecutedValue,
      }),
    };
  }

  async function patch(values: FormValues) {
    if (!current) return;
    await api(`/validations/${current.id}/draft`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
  }

  function cacheCurrentDraft() {
    if (!currentId) return;
    setValidationDraft(currentId, form.getValues());
  }

  function selectValidation(id: string) {
    if (id === currentId) return;
    if (isSavingDraft) return;
    cacheCurrentDraft();
    setCurrentId(id);
  }

  function handleTabChange(nextTab: string) {
    if (activeTab === 'validations' && nextTab !== 'validations') {
      cacheCurrentDraft();
    }
    setActiveTab(nextTab);
  }

  async function save(values: FormValues) {
    if (blockPreviewAction()) return;
    if (!current) return;
    if (isSavingDraft) return;
    const savedId = current.id;
    const payload = toDraftPayload(values);
    setIsSavingDraft(true);
    try {
      await patch(payload);
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
      if (currentIdRef.current === savedId) {
        clearValidationDraft(savedId);
        form.reset(payload);
      } else {
        setValidationDraft(savedId, payload);
      }
      toast.success('Rascunho salvo.');
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function submitAll() {
    if (blockPreviewAction()) return;
    if (isSubmittingAll) return;

    const targetStatuses = ['RASCUNHO', 'DEVOLVIDO'];
    const pending = validations.filter((item) => targetStatuses.includes(item.status));
    if (!pending.length) {
      toast.info('Nenhuma validação pronta para envio à SEPLAN.');
      return;
    }

    const editableNow = current && targetStatuses.includes(current.status);
    setIsSubmittingAll(true);
    try {
      if (editableNow && current && form.formState.isDirty) {
        const draft = toDraftPayload(form.getValues() as FormValues);
        if (draft) {
          await patch(draft as FormValues);
          form.reset(draft);
        }
      }

      if (editableNow && current) {
        await form.trigger();
      }

      const issues = collectPendingValidationIssues(
        pending,
        current?.id,
        editableNow && current ? form.getValues() : null,
      );
      setSubmitIssues(issues);
      setSubmitIssuesOpen(issues.length > 0);

      if (issues.length > 0) {
        const fieldCount = issues.reduce((total, issue) => total + issue.items.length, 0);
        toast.warning(
          `${issues.length} validação${issues.length !== 1 ? 'ões' : ''} com pendências (${fieldCount} campo${fieldCount !== 1 ? 's' : ''}). Veja o botão Pendências ao lado.`,
        );
      }

      const result = await api<{ enviadas: number; incompletas: number }>('/validations/submit-all', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (result.enviadas === 0 && result.incompletas === 0) {
        toast.info('Nenhuma validação completa para envio neste momento.');
      } else {
        const parts = [`${result.enviadas} enviada${result.enviadas !== 1 ? 's' : ''}`];
        if (result.incompletas > 0) {
          parts.push(
            `${result.incompletas} incompleta${result.incompletas !== 1 ? 's' : ''} não enviada${result.incompletas !== 1 ? 's' : ''}`,
          );
        }
        const reminder =
          issues.length > 0 ? ' Confira o botão Pendências ao lado.' : '';
        toast.success(`Respostas enviadas para SEPLAN: ${parts.join(', ')}.${reminder}`);
      }

      await load();
      clearAllValidationDrafts();
      prevCurrentIdRef.current = null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar respostas para SEPLAN.');
    } finally {
      setIsSubmittingAll(false);
    }
  }

  async function createAssignment() {
    if (blockPreviewAction()) return;
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
      setActions((prev) => appendActionAssignment(prev, selectedActionId, created));
      setSummary((prev) => incrementSummaryAssignments(prev, 1));
      toast.success('Ação classificada no orçamento temático.');
      try {
        const fresh = await fetchCurationSnapshot();
        setActions(fresh.actions);
        setSummary(fresh.summary);
        // A validação RASCUNHO é gerada automaticamente no backend; recarrega
        // para que apareça imediatamente na aba Validações.
        const freshValidations = await api<ValidationItem[]>('/validations/my');
        setValidations(freshValidations);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao classificar ação.');
    }
  }

  async function updateAssignment() {
    if (blockPreviewAction()) return;
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
      setActions((prev) => appendActionAssignment(prev, selectedActionId, updated));
      toast.success('Classificação atualizada.');
      try {
        const fresh = await fetchCurationSnapshot();
        setActions(fresh.actions);
        setSummary(fresh.summary);
        // A classificação alterada reflete na aba Validações.
        const freshValidations = await api<ValidationItem[]>('/validations/my');
        setValidations(freshValidations);
      } catch {
        /* mantém estado otimista */
      }
    } catch (err) {
      setActions(snapshot);
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar a classificação.');
    }
  }

  async function confirmRemoveAssignment() {
    if (blockPreviewAction()) return;
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
        setSummary((prev) => (prev ? decrementSummaryAssignments(prev, succeeded.length) : prev));
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

  const editable =
    !isPreview &&
    userRole === 'SECRETARIA_REPRESENTANTE' &&
    (current?.status === 'RASCUNHO' || current?.status === 'DEVOLVIDO');
  const selectedAction = actions.find((action) => action.id === selectedActionId);
  const currentTheme = assignment.theme;
  const axes = metadata?.axes[currentTheme] ?? [];
  const classifications = metadata?.classifications[currentTheme] ?? [];
  const existingAssignment =
    selectedAction?.assignments.find((item) => item.theme === assignment.theme) ?? null;
  const selectedActionHasTheme = Boolean(existingAssignment);
  const assignmentsRemovalKey = selectedAction?.assignments.map((a) => a.id).join() ?? '';

  useEffect(() => {
    if (!removePopoverOpen) {
      setAssignmentIdsPendingRemoval([]);
      return;
    }
    setAssignmentIdsPendingRemoval(selectedAction?.assignments.map((item) => item.id) ?? []);
  }, [removePopoverOpen, selectedAction?.id, assignmentsRemovalKey, selectedAction?.assignments]);

  useEffect(() => {
    setRemovePopoverOpen(false);
  }, [selectedActionId]);

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
      weightingFactor:
        existing?.weightingFactor != null ? String(existing.weightingFactor) : '',
      justification: existing?.justification ?? '',
    }));
  }, [selectedActionId, assignment.theme, actions]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-primary/30 bg-primary text-primary-foreground shadow-sm">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6 2xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
            <span className="text-primary-foreground/50 font-semibold select-none" style={{ fontSize: '22px' }}>|</span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>Orçamentos Temáticos</span>
              {organizationName ? (
                <span
                  className="truncate text-sm font-medium text-primary-foreground/80"
                  title={organizationName}
                >
                  {organizationName}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/secretaria/ajuda">
                <CircleHelpIcon data-icon="inline-start" />
                Ajuda
              </Link>
            </Button>
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
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span>{item.label}</span>
                    <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </PopoverContent>
            </Popover>
            <Button className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" variant="ghost" disabled={isSigningOut} onClick={signOut}>
              {isSigningOut ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : <LogOutIcon data-icon="inline-start" />}
              {isSigningOut ? 'Saindo...' : 'Sair'}
            </Button>
          </div>
        </div>
      </header>

      {isPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-50 px-4 py-2.5 text-amber-900 lg:px-6 2xl:px-8 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2 text-sm">
            <EyeIcon className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">Modo de pré-visualização.</span>{' '}
              Você está vendo a tela como{' '}
              <span className="font-semibold">Representante de Secretaria</span>
              . As ações de edição estão desativadas.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 bg-white text-amber-900 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100"
            onClick={() => router.push('/seplan')}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar ao painel
          </Button>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full px-6 py-5 lg:px-8 2xl:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="apresentacao">Como funciona</TabsTrigger>
            <TabsTrigger value="curation">Curadoria temática</TabsTrigger>
            <TabsTrigger value="validations">Validar Entregas</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <SummaryCountBadge count={validations.length} label="validações" />
            <SummaryCountBadge count={summary?.assignments ?? 0} label="classificações" />
            {userRole === 'SECRETARIA_REPRESENTANTE' && (
              <SecretariaBulkActions
                validations={validations}
                isSubmittingAll={isSubmittingAll}
                submitIssues={submitIssues}
                submitIssuesOpen={submitIssuesOpen}
                onSubmitIssuesOpenChange={(open) => {
                  setSubmitIssuesOpen(open);
                  if (!open) setSubmitIssues([]);
                }}
                onSubmitSeplan={() => void submitAll()}
              />
            )}

          </div>
        </div>

        <TabsContent value="apresentacao" className="mt-0">
          <SecretariaOnboardingSlides onFinish={() => handleTabChange('curation')} />
        </TabsContent>

        <TabsContent value="validations" forceMount className="mt-0 data-[state=inactive]:hidden">
          <div className="grid w-full gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Ações recebidas</CardTitle>
                <CardDescription>Selecione uma ação para preencher a validação.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {validations.length ? (
                  <ScrollArea className="h-[720px] w-full">
                    <ul role="list" className="flex flex-col gap-2 p-3">
                      {validations.map((validation) => {
                        const isActive = current?.id === validation.id;
                        return (
                          <li key={validation.id}>
                            <button
                              type="button"
                              onClick={() => selectValidation(validation.id)}
                              aria-pressed={isActive}
                              disabled={isSavingDraft && !isActive}
                              className={cn(
                                'group/item flex w-full gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left shadow-sm transition-all hover:border-foreground/30 hover:shadow focus-visible:border-foreground/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                                isActive && 'border-foreground bg-muted/40 shadow-md',
                              )}
                            >
                              <div className="flex min-w-0 flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <StatusBadge status={validation.status} />
                                  <ThemeBadge theme={validation.theme} />
                                </div>
                                <p className="break-words text-sm font-semibold leading-5 text-foreground">
                                  {validation.action?.application}
                                </p>
                                <div className="flex min-w-0 items-baseline gap-2 border-t border-border/60 pt-2">
                                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                                    {validation.action?.unitCode}
                                  </span>
                                  <span className="truncate text-[11px] text-muted-foreground" title={validation.action?.unitName}>
                                    {validation.action?.unitName}
                                  </span>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CheckIcon />
                      </EmptyMedia>
                      <EmptyTitle>Nenhuma ação disponível</EmptyTitle>
                      <EmptyDescription>Classifique ações na aba Curadoria temática para que apareçam aqui.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <section className="flex flex-col gap-5">
              {current ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{current.action?.application}</CardTitle>
                      <CardDescription>{current.action?.projectActivity} | {current.action?.organizationName}</CardDescription>
                      <CardAction className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const value = current.assignment?.classification;
                          if (!value) {
                            return (
                              <Badge variant="outline" className="italic text-muted-foreground">
                                Não classificado
                              </Badge>
                            );
                          }
                          const label = metadata?.classifications?.[current.theme as ThemeBudget]
                            ?.find((opt) => opt.value === value)?.label ?? value;
                          return (
                            <Badge variant="outline" title={label} className="font-medium">
                              {label}
                            </Badge>
                          );
                        })()}
                        <ThemeBadge theme={current.theme} />
                        <StatusBadge status={current.status} />
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-muted-foreground">Unidade</p>
                          <p className="font-medium">{current.action?.unitCode} - {current.action?.unitName}</p>
                        </div>
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <p className="text-sm text-muted-foreground">Inicial Planejado</p>
                            <p className="text-2xl font-semibold">{formatMoney(current.action?.totals.initialBudget ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Liquidado</p>
                            <p className="text-2xl font-semibold">{formatMoney(current.action?.totals.liquidated ?? 0)}</p>
                          </div>
                        </div>
                      </div>
                      {current.reviewerComment ? (
                        <Alert className="border-primary/25 bg-primary/5 text-primary">
                          <InfoIcon />
                          <AlertTitle>Comentário da SEPLAN</AlertTitle>
                          <AlertDescription>{current.reviewerComment}</AlertDescription>
                        </Alert>
                      ) : null}
                    </CardContent>
                  </Card>

                  <ValidationForm
                    form={form}
                    deliveries={deliveries}
                    editable={editable}
                    theme={current.theme}
                    classification={current.assignment?.classification ?? ''}
                    programName={current.action?.application}
                    onSave={save}
                    isSaving={isSavingDraft}
                  />
                </>
              ) : (
                <Card>
                  <CardContent>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileCheck2Icon />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma validação pendente</EmptyTitle>
                        <EmptyDescription>Selecione uma ação na lista para preencher a validação.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="curation">
          <ThematicCurationPanel
            actions={actions}
            metadata={metadata}
            selectedActionId={selectedActionId}
            onSelectActionId={setSelectedActionId}
            expandedActionId={expandedActionId}
            onExpandActionId={setExpandedActionId}
            assignment={assignment}
            onAssignmentChange={setAssignment}
            selectedActionHasTheme={selectedActionHasTheme}
            isRemovingAssignment={isRemovingAssignment}
            removePopoverOpen={removePopoverOpen}
            onRemovePopoverOpenChange={setRemovePopoverOpen}
            assignmentIdsPendingRemoval={assignmentIdsPendingRemoval}
            onAssignmentIdsPendingRemovalChange={setAssignmentIdsPendingRemoval}
            onCreateAssignment={createAssignment}
            onUpdateAssignment={updateAssignment}
            onConfirmRemoveAssignment={confirmRemoveAssignment}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
