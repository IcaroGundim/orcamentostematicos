'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpenIcon, CheckIcon, ChevronDownIcon, ExternalLinkIcon, FileCheck2Icon, InfoIcon, LogOutIcon, PlusIcon, SaveIcon, SendIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { api, clearStoredSession, formatMoney, getStoredSession, LEGISLATION_LINKS } from '@/lib/api';
import type { ValidationItem } from '@/types/domain';

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

export default function SecretariaPage() {
  const router = useRouter();
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [currentId, setCurrentId] = useState('');
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
    const data = await api<ValidationItem[]>('/validations/my');
    setValidations(data);
    setCurrentId((id) => id || data[0]?.id || '');
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

  const editable = current?.status === 'RASCUNHO' || current?.status === 'DEVOLVIDO';

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
            <Button className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" variant="ghost" onClick={() => { clearStoredSession(); router.push('/login'); }}>
              <LogOutIcon data-icon="inline-start" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="grid w-full gap-5 px-6 py-5 lg:px-8 xl:grid-cols-[430px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)] 2xl:px-10">
        <Card className="ring-primary/15">
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
              <Card className="ring-primary/15">
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
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Liquidado no QDD</p>
                      <p className="text-2xl font-semibold">{formatMoney(current.action?.totals.liquidated ?? 0)}</p>
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

              <Card className="ring-primary/15">
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
            <Card className="ring-primary/15">
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
