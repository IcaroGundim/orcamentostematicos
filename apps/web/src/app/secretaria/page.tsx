'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FolderCogIcon,
  InfoIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  Undo2Icon,
} from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, SummaryCountBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { ValidationForm } from '@/components/domain/validation-form';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels, statusLabels } from '@/lib/api';
import { isExclusiveAllocation, resolveWeightingFactor } from '@/lib/classification-rules';
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
import type { BudgetAction, Metadata, Summary, ThematicAssignment, ThemeBudget, ValidationItem } from '@/types/domain';

type FormInput = ValidationFormInput;
type FormValues = ValidationFormValues;

const allValue = 'ALL';

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
  const [assignment, setAssignment] = useState(initialAssignment);
  const [unitFilter, setUnitFilter] = useState(allValue);
  const [actionFilter, setActionFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState(allValue);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [removePopoverOpen, setRemovePopoverOpen] = useState(false);
  const [assignmentIdsPendingRemoval, setAssignmentIdsPendingRemoval] = useState<string[]>([]);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [submitIssues, setSubmitIssues] = useState<ValidationSubmitIssue[]>([]);
  const [submitIssuesOpen, setSubmitIssuesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('curation');
  const [userRole, setUserRole] = useState<string>('');
  const [internalReviewComment, setInternalReviewComment] = useState('');
  const [isActionReviewing, setIsActionReviewing] = useState(false);
  const [isReviewingAll, setIsReviewingAll] = useState(false);
  const prevCurrentIdRef = useRef<string | null>(null);
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
    if (session.user.role !== 'SECRETARIA_REPRESENTANTE' && session.user.role !== 'SECRETARIA_REVISOR') {
      router.push('/seplan');
      return;
    }
    setUserRole(session.user.role);
    if (session.user.role === 'SECRETARIA_REVISOR') {
      setActiveTab('validations');
    }
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
    setSubmitIssues([]);
    setSubmitIssuesOpen(false);
    setInternalReviewComment('');
  }, [currentId]);

  async function handleInternalApprove(id: string) {
    if (isActionReviewing) return;
    setIsActionReviewing(true);
    try {
      await api(`/validations/${id}/internal-approve`, {
        method: 'POST',
      });
      toast.success('Validação aprovada e enviada com sucesso para a SEPLAN!');
      await load();
      setInternalReviewComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar validação.');
    } finally {
      setIsActionReviewing(false);
    }
  }

  async function handleInternalReturn(id: string) {
    if (isActionReviewing) return;
    if (!internalReviewComment.trim()) {
      toast.warning('O comentário de devolução é obrigatório.');
      return;
    }
    setIsActionReviewing(true);
    try {
      await api(`/validations/${id}/internal-return`, {
        method: 'POST',
        body: JSON.stringify({ internalReviewerComment: internalReviewComment }),
      });
      toast.success('Validação devolvida com sucesso para o técnico.');
      await load();
      setInternalReviewComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao devolver validação.');
    } finally {
      setIsActionReviewing(false);
    }
  }

  async function reviewAll(approve: boolean) {
    if (isReviewingAll) return;

    const pending = validations.filter((item) => item.status === 'ENVIADO_REVISOR');
    if (!pending.length) {
      toast.info('Nenhuma validação pendente de revisão.');
      return;
    }

    let comment = '';
    if (!approve) {
      const userInput = prompt('Digite o comentário de devolução para todas as validações:');
      if (userInput === null) return; // User cancelled
      if (!userInput.trim()) {
        toast.warning('O comentário de devolução é obrigatório para realizar a devolução.');
        return;
      }
      comment = userInput;
    }

    setIsReviewingAll(true);
    try {
      const result = await api<{ revisados?: number; error?: string }>('/validations/review-all', {
        method: 'POST',
        body: JSON.stringify({ approve, reviewerComment: comment }),
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.revisados) {
        toast.success(
          approve
            ? `Aprovadas com sucesso ${result.revisados} validação(ões)!`
            : `Devolvidas com sucesso ${result.revisados} validação(ões) para o técnico!`
        );
        await load();
      } else {
        toast.info('Nenhuma validação revisada.');
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Erro ao realizar a revisão em lote.`
      );
    } finally {
      setIsReviewingAll(false);
    }
  }

  async function load() {
    const [validationData, meta, actionData, summaryData] = await Promise.all([
      api<ValidationItem[]>('/validations/my'),
      api<Metadata>('/metadata'),
      api<BudgetAction[]>('/budget-actions'),
      api<Summary>('/reports/summary'),
    ]);

    setValidations(validationData);
    setMetadata(meta);
    setActions(actionData);
    setSummary(summaryData);
    setCurrentId((id) => id || validationData[0]?.id || '');
    setSelectedActionId((id) => id || actionData[0]?.id || '');
  }

  function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    clearStoredSession();
    router.push('/login');
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
    if (!current) return;
    await patch(values);
    clearValidationDraft(current.id);
    setValidations((prev) =>
      prev.map((item) =>
        item.id === current.id
          ? {
              ...item,
              executionStatus: values.executionStatus,
              realizedDescription: values.realizedDescription,
              informedExecutedValue: values.informedExecutedValue,
              observations: values.observations ?? '',
              deliveries: values.deliveries.map((delivery) => ({
                id: delivery.id,
                name: delivery.name,
                description: delivery.description,
                quantity: delivery.quantity,
                municipality: delivery.municipality,
                beneficiaries: delivery.beneficiaries,
              })),
            }
          : item,
      ),
    );
    form.reset(values);
    toast.success('Rascunho salvo.');
  }

  async function submitAll(toSeplan: boolean) {
    if (isSubmittingAll) return;

    const targetStatuses = toSeplan ? ['APROVADO_REVISOR'] : ['RASCUNHO', 'DEVOLVIDO', 'DEVOLVIDO_REVISOR'];
    const pending = validations.filter((item) => targetStatuses.includes(item.status));
    if (!pending.length) {
      toast.info(`Nenhuma validação pronta para ${toSeplan ? 'envio à SEPLAN' : 'revisão interna'}.`);
      return;
    }

    const editableNow = current && targetStatuses.includes(current.status);
    setIsSubmittingAll(true);
    try {
      if (editableNow && current && form.formState.isDirty) {
        await patch(form.getValues() as FormValues);
        form.reset(form.getValues());
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
          `${issues.length} validação${issues.length !== 1 ? 'ões' : ''} com pendências (${fieldCount} campo${fieldCount !== 1 ? 's' : ''}). Veja o balão ao lado do botão de envio.`,
        );
      }

      const result = await api<{ enviadas: number; incompletas: number }>('/validations/submit-all', {
        method: 'POST',
        body: JSON.stringify({ toSeplan }),
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
          issues.length > 0 ? ' Confira o balão de pendências ao lado do botão de envio.' : '';
        toast.success(
          toSeplan
            ? `Respostas enviadas para SEPLAN: ${parts.join(', ')}.${reminder}`
            : `Respostas enviadas para Revisão Interna: ${parts.join(', ')}.${reminder}`
        );
      }

      await load();
      clearAllValidationDrafts();
      prevCurrentIdRef.current = null;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Erro ao enviar respostas para ${toSeplan ? 'SEPLAN' : 'Revisão Interna'}.`,
      );
    } finally {
      setIsSubmittingAll(false);
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
    userRole === 'SECRETARIA_REPRESENTANTE' &&
    (current?.status === 'RASCUNHO' ||
      current?.status === 'DEVOLVIDO' ||
      current?.status === 'DEVOLVIDO_REVISOR');
  const units = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const action of actions) {
      if (!map.has(action.unitCode)) {
        map.set(action.unitCode, { code: action.unitCode, name: action.unitName });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [actions]);

  const filteredActions = useMemo(() => {
    const search = normalize(actionFilter);
    return actions.filter((action) => {
      if (unitFilter !== allValue && action.unitCode !== unitFilter) return false;
      if (themeFilter !== allValue && !action.assignments.some((item) => item.theme === themeFilter)) return false;
      if (!search) return true;
      return [
        action.application,
        action.functionalProgram,
        action.projectActivity,
        action.organizationName,
        action.unitName,
      ].some((value) => normalize(value).includes(search));
    });
  }, [actions, actionFilter, themeFilter, unitFilter]);

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

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-primary/30 bg-primary text-primary-foreground shadow-sm">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6 2xl:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
            <span className="text-primary-foreground/50 font-semibold select-none" style={{ fontSize: '22px' }}>|</span>
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
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full px-6 py-5 lg:px-8 2xl:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {userRole !== 'SECRETARIA_REVISOR' ? (
            <TabsList>
              <TabsTrigger value="curation">Curadoria temática</TabsTrigger>
              <TabsTrigger value="validations">Validar Entregas</TabsTrigger>
            </TabsList>
          ) : (
            <h1 className="text-xl font-bold tracking-tight text-foreground">Revisão de Entregas (Pasta)</h1>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SummaryCountBadge count={validations.length} label="validações" />
            <SummaryCountBadge count={summary?.assignments ?? 0} label="classificações" />
            {userRole === 'SECRETARIA_REPRESENTANTE' && (
              <div className="flex gap-2.5">
                <Popover
                  open={submitIssuesOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      setSubmitIssuesOpen(false);
                      setSubmitIssues([]);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10 hover:text-amber-800 shadow-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      disabled={
                        isSubmittingAll ||
                        !validations.some((v) => v.status === 'RASCUNHO' || v.status === 'DEVOLVIDO' || v.status === 'DEVOLVIDO_REVISOR')
                      }
                      onClick={() => void submitAll(false)}
                    >
                      {isSubmittingAll ? (
                        <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                      ) : (
                        <SendIcon data-icon="inline-start" className="size-4" />
                      )}
                      {isSubmittingAll ? 'Enviando...' : 'Enviar para Revisão Interna'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    className="flex w-[min(96vw,28rem)] flex-col gap-3 border-destructive/30 bg-popover p-4 shadow-lg"
                  >
                    <div className="flex items-start gap-2">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold leading-none text-destructive">Itens pendentes antes do envio</p>
                        <p className="text-sm text-muted-foreground">
                          Complete os campos abaixo antes de enviar para Revisão Interna.
                        </p>
                      </div>
                    </div>
                    <ScrollArea className="max-h-[min(50vh,16rem)] w-full rounded-lg border border-destructive/20 bg-muted">
                      <div className="flex flex-col gap-4 p-3 text-sm">
                        {submitIssues.map((group) => (
                          <div key={group.validationId}>
                            <p className="font-medium text-foreground">
                              {group.title}
                              {group.isSelected ? (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  (validação selecionada)
                                </span>
                              ) : null}
                            </p>
                            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                              {group.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end border-t border-destructive/20 pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSubmitIssuesOpen(false);
                          setSubmitIssues([]);
                        }}
                      >
                        Fechar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={
                    isSubmittingAll ||
                    !validations.some((v) => v.status === 'APROVADO_REVISOR')
                  }
                  onClick={() => void submitAll(true)}
                >
                  {isSubmittingAll ? (
                    <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                  ) : (
                    <SendIcon data-icon="inline-start" className="size-4" />
                  )}
                  {isSubmittingAll ? 'Enviando...' : 'Enviar para SEPLAN'}
                </Button>
              </div>
            )}

            {userRole === 'SECRETARIA_REVISOR' && (
              <div className="flex gap-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10 hover:text-amber-800 shadow-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={
                    isReviewingAll ||
                    !validations.some((v) => v.status === 'ENVIADO_REVISOR')
                  }
                  onClick={() => void reviewAll(false)}
                >
                  {isReviewingAll ? (
                    <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                  ) : (
                    <Undo2Icon data-icon="inline-start" className="size-4" />
                  )}
                  Devolver para Correção
                </Button>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={
                    isReviewingAll ||
                    !validations.some((v) => v.status === 'ENVIADO_REVISOR')
                  }
                  onClick={() => void reviewAll(true)}
                >
                  {isReviewingAll ? (
                    <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                  ) : (
                    <CheckIcon data-icon="inline-start" className="size-4" />
                  )}
                  Aprovar Tudo
                </Button>
              </div>
            )}
          </div>
        </div>

        <TabsContent value="validations" forceMount className="mt-0 data-[state=inactive]:hidden">
          <div className="grid w-full gap-5 xl:grid-cols-[430px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Ações recebidas</CardTitle>
                <CardDescription>Selecione uma ação para preencher a validação.</CardDescription>
              </CardHeader>
              <CardContent>
                {validations.length ? (
                  <ScrollArea className="h-[720px] pr-3">
                    <div className="flex flex-col gap-2">
                      {validations.map((validation) => (
                        <button
                          key={validation.id}
                          className={cn(
                            'rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50',
                            current?.id === validation.id && 'border-primary bg-primary/5',
                          )}
                          onClick={() => selectValidation(validation.id)}
                        >
                          <div className="mb-2 flex flex-wrap gap-2">
                            <StatusBadge status={validation.status} />
                            <ThemeBadge theme={validation.theme} />
                          </div>
                          <p className="font-medium leading-snug">{validation.action?.application}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{validation.action?.unitCode} - {validation.action?.unitName}</p>
                        </button>
                      ))}
                    </div>
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
                      <CardAction className="flex gap-2">
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
                            <p className="text-sm text-muted-foreground">Liquidado no QDD</p>
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
                      {current.internalReviewerComment ? (
                        <Alert className="border-amber-500/25 bg-amber-500/5 text-amber-800 dark:text-amber-300">
                          <InfoIcon className="text-amber-500" />
                          <AlertTitle className="text-amber-600 font-semibold">Comentário do Revisor Interno</AlertTitle>
                          <AlertDescription>{current.internalReviewerComment}</AlertDescription>
                        </Alert>
                      ) : null}
                    </CardContent>
                  </Card>

                  {userRole === 'SECRETARIA_REVISOR' && (
                    <Card className="border-primary/30 bg-primary/[0.02]">
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">Painel de Revisão Interna</CardTitle>
                        <CardDescription>
                          Examine os dados preenchidos pelo técnico. Você pode aprovar o envio para a SEPLAN ou devolver para ajustes.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        {current.status === 'ENVIADO_REVISOR' ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label htmlFor="internalComment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Observações / Justificativa da Devolução
                              </label>
                              <Textarea
                                id="internalComment"
                                placeholder="Caso devolva para o técnico, informe aqui o motivo ou o que precisa ser corrigido..."
                                value={internalReviewComment}
                                onChange={(e) => setInternalReviewComment(e.target.value)}
                                className="min-h-[80px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                onClick={() => handleInternalApprove(current.id)}
                                disabled={isActionReviewing}
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                {isActionReviewing ? (
                                  <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                                ) : (
                                  <CheckIcon data-icon="inline-start" className="size-4" />
                                )}
                                Aprovar e Enviar para SEPLAN
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleInternalReturn(current.id)}
                                disabled={isActionReviewing || !internalReviewComment.trim()}
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                {isActionReviewing ? (
                                  <RefreshCwIcon data-icon="inline-start" className="animate-spin size-4" />
                                ) : (
                                  <Trash2Icon data-icon="inline-start" className="size-4" />
                                )}
                                Devolver ao Técnico
                              </Button>
                            </div>
                            {!internalReviewComment.trim() && (
                              <p className="text-[11px] text-muted-foreground">
                                * O comentário é obrigatório para realizar a devolução.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                            <InfoIcon className="size-4" />
                            <span>
                              Status atual: <strong>{statusLabels[current.status]}</strong>. Ações de revisão interna só estão disponíveis para itens aguardando revisão interna.
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <ValidationForm
                    form={form}
                    deliveries={deliveries}
                    editable={editable}
                    onSave={save}
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
          {userRole !== 'SECRETARIA_REVISOR' ? (
            <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Ações da secretaria</CardTitle>
                <CardDescription>{filteredActions.length} de {actions.length} ações no recorte da secretaria</CardDescription>
                <CardAction className="flex flex-wrap items-center gap-2">
                  <Select value={unitFilter} onValueChange={setUnitFilter}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={allValue}>Todas as unidades</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.code} value={unit.code}>{unit.code} - {unit.name}</SelectItem>
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
              <CardContent className="p-0">
                {actions.length ? (
                  <>
                    <ScrollArea className="h-[700px] w-full">
                      <div className="overflow-x-auto">
                        <Table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-[80px]" />
                            <col className="w-[32%]" />
                            <col className="w-[140px]" />
                            <col className="w-[140px]" />
                            <col className="w-[90px]" />
                          </colgroup>
                          <TableHeader className="sticky top-0 z-10 bg-card">
                            <TableRow>
                              <TableHead className="h-9 pl-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">Unidade</TableHead>
                              <TableHead className="h-9 min-w-0 whitespace-normal break-words text-xs uppercase tracking-[0.12em] text-muted-foreground">Programa / ação</TableHead>
                              <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Planejado</TableHead>
                              <TableHead className="h-9 text-xs uppercase tracking-[0.12em] text-muted-foreground">Execução</TableHead>
                              <TableHead className="h-9 pr-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">Temas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredActions.map((action) => (
                              <TableRow key={action.id} className={cn(selectedActionId === action.id && 'bg-primary/5')}>
                                <TableCell className="py-3 pl-4 align-top">
                                  <span className="block text-sm font-semibold tabular-nums">{action.unitCode}</span>
                                  <span className="block truncate text-xs text-muted-foreground" title={action.unitName}>{action.unitName}</span>
                                </TableCell>
                                <TableCell className="min-w-0 whitespace-normal break-words py-3 align-top">
                                  <button
                                    type="button"
                                    className="flex min-w-0 w-full flex-col gap-0.5 text-left text-sm font-medium leading-5 text-primary break-words hover:underline"
                                    title={`${action.projectActivity} - ${action.application}`}
                                    onClick={() => setSelectedActionId(action.id)}
                                  >
                                    <span className="font-semibold tabular-nums">{action.projectActivity}</span>
                                    <span className="line-clamp-3 break-words font-normal">{action.application}</span>
                                  </button>
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={action.functionalProgram}>{action.functionalProgram}</p>
                                </TableCell>
                                <TableCell className="py-3 text-right align-top text-sm">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-muted-foreground">Inicial</span>
                                      <span className="tabular-nums">{formatMoney(action.totals.initialBudget)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-muted-foreground">Atualizado</span>
                                      <span className="tabular-nums font-medium">{formatMoney(action.totals.updatedBudget)}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-right align-top text-sm">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-muted-foreground">Liquidado</span>
                                      <span className="tabular-nums">{formatMoney(action.totals.liquidated)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-muted-foreground">Disponível</span>
                                      <span className="tabular-nums font-medium">{formatMoney(action.totals.available)}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 pr-4 align-top">
                                  <div className="flex flex-wrap gap-1">
                                    {action.assignments.length ? (
                                      action.assignments.map((item) => <ThemeBadge key={item.id} theme={item.theme} />)
                                    ) : (
                                      <Badge variant="secondary">Sem tema</Badge>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                    {filteredActions.length === 0 ? (
                      <div className="px-4 pb-4">
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <SearchIcon />
                            </EmptyMedia>
                            <EmptyTitle>Nenhuma ação encontrada</EmptyTitle>
                            <EmptyDescription>Ajuste os filtros para consultar as ações da secretaria.</EmptyDescription>
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
                        <EmptyDescription>Não há ações no QDD vigente para esta secretaria.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Curadoria temática</CardTitle>
                <CardDescription>
                  {selectedAction ? `${selectedAction.projectActivity} - ${selectedAction.application}` : 'Selecione uma ação da secretaria.'}
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
                          weightingFactor: isExclusiveAllocation(assignment.theme, classification) ? '1' : '',
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
                  <Field data-disabled={isExclusiveAllocation(assignment.theme, assignment.classification) || undefined}>
                    <FieldLabel htmlFor="weightingFactor">Ponderador</FieldLabel>
                    <Input
                      id="weightingFactor"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={
                        isExclusiveAllocation(assignment.theme, assignment.classification)
                          ? '1'
                          : assignment.weightingFactor
                      }
                      disabled={isExclusiveAllocation(assignment.theme, assignment.classification)}
                      onChange={(event) => setAssignment({ ...assignment, weightingFactor: event.target.value })}
                      placeholder="Opcional"
                    />
                    {isExclusiveAllocation(assignment.theme, assignment.classification) ? (
                      <FieldDescription>
                        Dotação exclusiva: 100% do valor do programa (ponderador fixo em 1).
                      </FieldDescription>
                    ) : null}
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
                        userRole === 'SECRETARIA_REVISOR' ||
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
                          disabled={isRemovingAssignment || userRole === 'SECRETARIA_REVISOR'}
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
          ) : (
            <div className="p-8 text-center text-muted-foreground bg-card rounded-lg border border-border">
              Acesso não autorizado para esta funcionalidade.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
