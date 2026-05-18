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
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { RemoveClassificationPopover } from '@/components/domain/remove-classification-popover';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS, themeLabels } from '@/lib/api';
import type { BudgetAction, Metadata, Summary, ThematicAssignment, ThemeBudget, ValidationItem } from '@/types/domain';

const schema = z.object({
  executionStatus: z.string().min(1),
  realizedDescription: z.string().min(5),
  informedExecutedValue: z.coerce.number().min(0),
  observations: z.string().optional(),
  deliveries: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().min(3),
      quantity: z.coerce.number().min(0),
      unit: z.string().min(1),
      municipality: z.string().min(1),
      beneficiaries: z.string().min(1),
    }),
  ),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

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
  const current = useMemo(() => validations.find((item) => item.id === currentId) ?? validations[0], [validations, currentId]);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  });
  const deliveries = useFieldArray({ control: form.control, name: 'deliveries' });
  const executionStatus = form.watch('executionStatus');

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'SECRETARIA_REPRESENTANTE') {
      router.push('/seplan');
      return;
    }
    load().catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados. O servidor pode estar indisponível.');
    });
  }, [router]);

  useEffect(() => {
    if (!current) return;
    form.reset({
      executionStatus: current.executionStatus ?? 'EM_EXECUCAO',
      realizedDescription: current.realizedDescription ?? '',
      informedExecutedValue: current.informedExecutedValue ?? 0,
      observations: current.observations ?? '',
      deliveries: current.deliveries.length ? current.deliveries : [blankDelivery()],
    });
  }, [current, form]);

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

  async function save(values: FormValues) {
    await patch(values);
    toast.success('Rascunho salvo.');
    await load();
  }

  async function submit(values: FormValues) {
    if (!current) return;
    await patch(values);
    await api(`/validations/${current.id}/submit`, { method: 'POST', body: JSON.stringify({}) });
    toast.success('Validação enviada para a SEPLAN.');
    await load();
  }

  async function createAssignment() {
    if (!selectedActionId) return;
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

  const editable = current?.status === 'RASCUNHO' || current?.status === 'DEVOLVIDO';
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

      <Tabs defaultValue="validations" className="w-full px-6 py-5 lg:px-8 2xl:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="validations">Validações</TabsTrigger>
            <TabsTrigger value="curation">Curadoria temática</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{validations.length} validações</Badge>
            <Badge variant="secondary">{summary?.assignments ?? 0} classificações</Badge>
          </div>
        </div>

        <TabsContent value="validations">
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
                          onClick={() => setCurrentId(validation.id)}
                        >
                          <div className="mb-2 flex flex-wrap gap-2">
                            <StatusBadge status={validation.status} />
                            <ThemeBadge theme={validation.theme} />
                          </div>
                          <p className="font-medium leading-snug">{validation.action?.application}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{validation.cycle?.name}</p>
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
                      <EmptyDescription>A SEPLAN ainda não abriu validações para esta secretaria.</EmptyDescription>
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
                    </CardContent>
                  </Card>

                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Formulário de validação</CardTitle>
                      <CardDescription>Informe o que foi realizado e as entregas correspondentes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={form.handleSubmit(submit)}>
                        <FieldGroup>
                          <div className="grid gap-4 md:grid-cols-3">
                            <Field data-disabled={!editable || undefined}>
                              <FieldLabel>Status da execução</FieldLabel>
                              <Select
                                value={executionStatus}
                                disabled={!editable}
                                onValueChange={(value) => form.setValue('executionStatus', value, { shouldValidate: true })}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="NAO_INICIADA">Não iniciada</SelectItem>
                                    <SelectItem value="EM_EXECUCAO">Em execução</SelectItem>
                                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                                    <SelectItem value="PARALISADA">Paralisada</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field data-disabled={!editable || undefined}>
                              <FieldLabel htmlFor="executedValue">Valor executado informado</FieldLabel>
                              <Input id="executedValue" disabled={!editable} type="number" step="0.01" {...form.register('informedExecutedValue')} />
                            </Field>
                            <Field data-disabled={!editable || undefined}>
                              <FieldLabel htmlFor="observations">Observações</FieldLabel>
                              <Input id="observations" disabled={!editable} {...form.register('observations')} />
                            </Field>
                          </div>

                          <Field data-disabled={!editable || undefined}>
                            <FieldLabel htmlFor="realizedDescription">Descrição do realizado</FieldLabel>
                            <Textarea id="realizedDescription" disabled={!editable} {...form.register('realizedDescription')} />
                          </Field>

                          <Separator />

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <h3 className="font-medium">Entregas realizadas</h3>
                              <p className="text-sm text-muted-foreground">Cadastre quantidade, unidade, município e público beneficiado.</p>
                            </div>
                            <Button type="button" variant="outline" disabled={!editable} onClick={() => deliveries.append(blankDelivery())}>
                              <PlusIcon data-icon="inline-start" />
                              Entrega
                            </Button>
                          </div>
                          <div className="flex flex-col gap-3">
                            {deliveries.fields.map((field, index) => (
                              <Card key={field.id} size="sm">
                                <CardContent className="grid gap-3 md:grid-cols-[1fr_120px_120px_1fr_1fr]">
                                  <Input disabled={!editable} placeholder="Descrição" {...form.register(`deliveries.${index}.description`)} />
                                  <Input disabled={!editable} type="number" placeholder="Qtd." {...form.register(`deliveries.${index}.quantity`)} />
                                  <Input disabled={!editable} placeholder="Unidade" {...form.register(`deliveries.${index}.unit`)} />
                                  <Input disabled={!editable} placeholder="Município" {...form.register(`deliveries.${index}.municipality`)} />
                                  <Input disabled={!editable} placeholder="Público beneficiado" {...form.register(`deliveries.${index}.beneficiaries`)} />
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant="outline" disabled={!editable} onClick={form.handleSubmit(save)}>
                              <SaveIcon data-icon="inline-start" />
                              Salvar rascunho
                            </Button>
                            <Button type="submit" disabled={!editable}>
                              <SendIcon data-icon="inline-start" />
                              Enviar para SEPLAN
                            </Button>
                          </div>
                        </FieldGroup>
                      </form>
                    </CardContent>
                  </Card>
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
                        <EmptyDescription>Quando um ciclo for aberto pela SEPLAN, as ações aparecerão aqui.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="curation">
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
        </TabsContent>
      </Tabs>
    </main>
  );
}

function blankDelivery() {
  return { description: '', quantity: 0, unit: '', municipality: '', beneficiaries: '' };
}

function emptyValues(): FormInput {
  return {
    executionStatus: 'EM_EXECUCAO',
    realizedDescription: '',
    informedExecutedValue: 0,
    observations: '',
    deliveries: [blankDelivery()],
  };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
