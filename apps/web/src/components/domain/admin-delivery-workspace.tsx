'use client';

import {
  CheckCircle2Icon,
  EraserIcon,
  FileCheck2Icon,
  MapPinIcon,
  PackageCheckIcon,
  PackageIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';

import { ACRE_MUNICIPALITY_OPTIONS, parseMunicipalitySelection } from '@/lib/acre-municipalities';
import { formatMoney, themeLabels } from '@/lib/api';
import { sumDeliveryExecutedValues, usesDeliveryValues } from '@/lib/classification-rules';
import { blankDelivery, type ValidationFormInput, type ValidationFormValues } from '@/lib/validation-schema';
import { cn } from '@/lib/utils';
import type { ThemeBudget, ValidationItem } from '@/types/domain';
import { StatusBadge, ThemeBadge } from '@/components/domain/badges';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

type AdminDeliveryWorkspaceProps = {
  validations: ValidationItem[];
  selectedId: string;
  current: ValidationItem | null;
  classificationLabel?: string;
  onSelect: (id: string) => void;
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  deliveries: UseFieldArrayReturn<ValidationFormInput, 'deliveries', 'id'>;
  onSave: (values: ValidationFormValues) => boolean | void | Promise<boolean | void>;
  onFinalize: (id: string) => void | Promise<void>;
  onReopen: (id: string) => void | Promise<void>;
  isSaving?: boolean;
  isFinalizing?: boolean;
};

type ThemeFilter = 'all' | ThemeBudget;

const ALL_FILTER_VALUE = 'all';

const themeAccent: Record<ThemeBudget, string> = {
  OCAD: 'bg-cyan-500',
  OSG: 'bg-violet-500',
  CLIMATICO: 'bg-emerald-600',
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isPublished(validation: ValidationItem) {
  return validation.status === 'APROVADO';
}

export function AdminDeliveryWorkspace({
  validations,
  selectedId,
  current,
  classificationLabel,
  onSelect,
  form,
  deliveries,
  onSave,
  onFinalize,
  onReopen,
  isSaving = false,
  isFinalizing = false,
}: AdminDeliveryWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState(ALL_FILTER_VALUE);
  const [unitFilter, setUnitFilter] = useState(ALL_FILTER_VALUE);
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');
  const watchedDeliveries = useWatch({ control: form.control, name: 'deliveries' });
  const deliveryTotal = useMemo(
    () => sumDeliveryExecutedValues(watchedDeliveries ?? []),
    [watchedDeliveries],
  );
  const publishedCount = validations.filter(isPublished).length;
  const draftCount = validations.length - publishedCount;
  const perDeliveryValues = current
    ? usesDeliveryValues(current.theme, current.assignment?.classification ?? '')
    : false;
  const { errors, isDirty } = form.formState;

  const organizationOptions = useMemo(() => {
    const organizations = new Map<string, string>();
    for (const validation of validations) {
      const code = validation.action?.organizationCode?.trim();
      if (!code) continue;
      organizations.set(code, validation.action?.organizationName?.trim() || code);
    }
    return [...organizations.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [validations]);

  const unitOptions = useMemo(() => {
    const units = new Map<string, { value: string; code: string; name: string; organizationCode: string }>();
    for (const validation of validations) {
      const organizationCode = validation.action?.organizationCode?.trim() || '';
      if (organizationFilter !== ALL_FILTER_VALUE && organizationCode !== organizationFilter) continue;
      const code = validation.action?.unitCode?.trim();
      if (!code) continue;
      const value = `${organizationCode}|${code}`;
      units.set(value, {
        value,
        code,
        name: validation.action?.unitName?.trim() || code,
        organizationCode,
      });
    }
    return [...units.values()].sort((a, b) =>
      a.organizationCode.localeCompare(b.organizationCode) || a.code.localeCompare(b.code),
    );
  }, [organizationFilter, validations]);

  const filteredValidations = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return [...validations]
      .filter((validation) => {
        if (
          organizationFilter !== ALL_FILTER_VALUE &&
          validation.action?.organizationCode !== organizationFilter
        ) return false;
        if (
          unitFilter !== ALL_FILTER_VALUE &&
          `${validation.action?.organizationCode ?? ''}|${validation.action?.unitCode ?? ''}` !== unitFilter
        ) return false;
        if (themeFilter !== 'all' && validation.theme !== themeFilter) return false;
        if (!normalizedQuery) return true;
        const action = validation.action;
        return normalize([
          action?.organizationCode,
          action?.organizationName,
          action?.unitName,
          action?.application,
          action?.projectActivity,
          themeLabels[validation.theme],
        ].filter(Boolean).join(' ')).includes(normalizedQuery);
      })
      .sort((a, b) =>
        Number(isPublished(a)) - Number(isPublished(b)) ||
        (a.action?.organizationCode ?? '').localeCompare(b.action?.organizationCode ?? '') ||
        (a.action?.application ?? '').localeCompare(b.action?.application ?? ''),
      );
  }, [organizationFilter, query, themeFilter, unitFilter, validations]);

  const clearDelivery = (index: number) => {
    const previous = form.getValues(`deliveries.${index}`);
    form.setValue(
      `deliveries.${index}`,
      {
        ...previous,
        name: '',
        description: '',
        quantity: 0,
        municipality: '',
        beneficiaries: '',
        executedValue: null,
      },
      { shouldDirty: true },
    );
    form.clearErrors(`deliveries.${index}`);
  };

  const handlePublish = form.handleSubmit(async (values) => {
    const saved = await onSave(values);
    if (saved === false || !current) return;
    await onFinalize(current.id);
  });

  const selectValidation = (id: string) => {
    if (id === selectedId) return;
    if (isDirty && !window.confirm('Há alterações não salvas. Deseja trocar de ação e descartá-las?')) return;
    onSelect(id);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black bg-background shadow-sm">
      <header className="shrink-0 border-b border-black bg-green-900 px-4 py-2 text-white lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-md border border-white/35 bg-white/10 text-white">
              <PackageCheckIcon className="size-3.5" />
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="shrink-0 text-base font-semibold leading-tight">Registro de entregas</h1>
              <p className="truncate text-xs text-white/70">
                Documente o que chegou à população e publique os registros consolidados nos resultados.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/25 overflow-hidden rounded-md border border-white/30 bg-white/5">
            <PortfolioMetric label="Registros" value={validations.length} />
            <PortfolioMetric label="Em edição" value={draftCount} />
            <PortfolioMetric label="Publicadas" value={publishedCount} />
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-[18rem] flex-col border-b border-black bg-card lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="space-y-2.5 border-b border-black p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Carteira de ações</h2>
                <p className="text-xs text-muted-foreground">Escolha onde registrar</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums text-foreground">
                {filteredValidations.length}
              </span>
            </div>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-black bg-background px-3 transition focus-within:ring-2 focus-within:ring-gray-300">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar órgão ou ação"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div className="rounded-lg border border-black bg-muted/40 p-1">
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                <CompactFilter label="Orçamento temático">
                  <SearchableCombobox
                    value={themeFilter}
                    onChange={(value) => setThemeFilter(value as ThemeFilter)}
                    items={[
                      { value: 'all', label: 'Todos os orçamentos' },
                      ...(['OCAD', 'OSG', 'CLIMATICO'] as const).map((theme) => ({
                        value: theme,
                        label: themeLabels[theme],
                      })),
                    ]}
                    placeholder="Digite para buscar"
                    triggerClassName="!h-7 !min-h-7 !border-black !px-2 !py-1 !text-xs"
                  />
                </CompactFilter>

                <CompactFilter label="Unidade">
                  <SearchableCombobox
                    value={unitFilter}
                    onChange={setUnitFilter}
                    items={[
                      { value: ALL_FILTER_VALUE, label: 'Todas as unidades' },
                      ...unitOptions.map((unit) => ({
                        value: unit.value,
                        label: `${organizationFilter === ALL_FILTER_VALUE ? `${unit.organizationCode} · ` : ''}${unit.code} — ${unit.name}`,
                      })),
                    ]}
                    placeholder="Digite para buscar"
                    triggerClassName="!h-7 !min-h-7 !border-black !px-2 !py-1 !text-xs"
                  />
                </CompactFilter>

                <CompactFilter label="Órgão" className="col-span-2">
                  <SearchableCombobox
                    value={organizationFilter}
                    onChange={(value) => {
                      setOrganizationFilter(value);
                      setUnitFilter(ALL_FILTER_VALUE);
                    }}
                    items={[
                      { value: ALL_FILTER_VALUE, label: 'Todos os órgãos' },
                      ...organizationOptions.map((organization) => ({
                        value: organization.code,
                        label: `${organization.code} — ${organization.name}`,
                      })),
                    ]}
                    placeholder="Digite para buscar"
                    triggerClassName="!h-7 !min-h-7 !border-black !px-2 !py-1 !text-xs"
                  />
                </CompactFilter>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredValidations.length ? (
              <div className="space-y-1">
                {filteredValidations.map((validation) => {
                  const selected = validation.id === selectedId;
                  return (
                    <button
                      key={validation.id}
                      type="button"
                      onClick={() => selectValidation(validation.id)}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'group relative w-full overflow-hidden rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-green-900 bg-card text-foreground ring-1 ring-green-900 shadow-sm'
                          : 'border-transparent bg-card hover:border-black hover:bg-muted/40',
                      )}
                    >
                      <span className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full', themeAccent[validation.theme])} />
                      <div className="flex items-center gap-2 pl-1.5">
                        <span className={cn('text-[10px] font-bold uppercase tracking-[0.13em]', selected ? 'text-green-900' : 'text-muted-foreground')}>
                          {validation.action?.organizationCode || 'Sem órgão'}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 pl-1.5 text-sm font-semibold leading-snug">
                        {validation.action?.application ?? 'Ação classificada'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 pl-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate">{themeLabels[validation.theme]}</span>
                        <span className="shrink-0 tabular-nums">{validation.deliveries?.length ?? 0} entrega(s)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center px-6 text-center">
                <div>
                <SearchIcon className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Nenhuma ação encontrada</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou o filtro selecionado.</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {current ? (
          <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 flex-col bg-muted/30">
            <div className="shrink-0 border-b border-black bg-card px-5 py-4 lg:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{current.action?.organizationCode}</span>
                    <span aria-hidden="true">/</span>
                    <span className="truncate">{current.action?.unitCode} — {current.action?.unitName}</span>
                  </div>
                  <h2 className="mt-1.5 max-w-4xl text-lg font-semibold leading-snug text-foreground lg:text-xl">
                    {current.action?.application}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{current.action?.projectActivity}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ThemeBadge theme={current.theme} />
                    <StatusBadge status={current.status} />
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                      Classificação
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">
                      {classificationLabel || current.assignment?.classification || 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
              <div className="mx-auto flex max-w-6xl flex-col gap-6">
                {isPublished(current) ? (
                  <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-primary">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Registro publicado nos resultados</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground/70">
                        Alterações ainda podem ser salvas. Use “Reabrir” somente para retirar temporariamente esta ação dos resultados.
                      </p>
                    </div>
                  </div>
                ) : null}

                <section>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-md bg-green-900 text-xs font-bold text-white">1</span>
                        <h3 className="text-base font-semibold text-foreground">Entregas realizadas</h3>
                      </div>
                      <p className="ml-9 mt-1 text-xs text-muted-foreground">Uma ficha para cada bem, serviço ou atendimento concluído.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-black bg-background text-foreground hover:bg-muted"
                      onClick={() => deliveries.append(blankDelivery(deliveries.fields.length + 1))}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Nova entrega
                    </Button>
                  </div>
                  <FieldError errors={errors.deliveries?.message ? [errors.deliveries] : undefined} />

                  <div className="space-y-3">
                    {deliveries.fields.map((field, index) => (
                      <AdminDeliveryEditor
                        key={field.id}
                        index={index}
                        form={form}
                        perDeliveryValues={perDeliveryValues}
                        canRemove={deliveries.fields.length > 1}
                        onClear={() => clearDelivery(index)}
                        onRemove={() => deliveries.remove(index)}
                      />
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-black bg-card shadow-sm">
                  <div className="flex items-center gap-2 border-b border-black bg-green-900 px-4 py-3 text-white">
                    <span className="grid size-7 place-items-center rounded-md border border-black bg-background text-xs font-bold text-foreground">2</span>
                    <div>
                      <h3 className="text-base font-semibold">Consolidação do registro</h3>
                      <p className="text-xs text-white/75">Síntese e informações financeiras para leitura nos resultados.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,.65fr)]">
                    <Field data-invalid={!!errors.realizedDescription || undefined}>
                      <FieldLabel htmlFor="admin-realized-description">Síntese da execução</FieldLabel>
                      <Textarea
                        id="admin-realized-description"
                        rows={4}
                        placeholder="Resuma os principais resultados alcançados pela ação…"
                        className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
                        {...form.register('realizedDescription')}
                      />
                      <FieldError errors={[errors.realizedDescription]} />
                    </Field>
                    <div className="space-y-4">
                      {perDeliveryValues ? (
                        <div className="rounded-lg border border-black bg-muted/40 px-4 py-3 text-foreground">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Total executado</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(deliveryTotal)}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Soma automática das entregas</p>
                        </div>
                      ) : (
                        <Field data-invalid={!!errors.informedExecutedValue || undefined}>
                          <FieldLabel htmlFor="admin-executed-value">Valor executado informado</FieldLabel>
                          <Controller
                            name="informedExecutedValue"
                            control={form.control}
                            render={({ field }) => (
                              <MoneyInput
                                id="admin-executed-value"
                                value={typeof field.value === 'number' ? field.value : undefined}
                                onValueChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
                              />
                            )}
                          />
                          <FieldError errors={[errors.informedExecutedValue]} />
                        </Field>
                      )}
                      <Field data-invalid={!!errors.observations || undefined}>
                        <FieldLabel htmlFor="admin-observations">Observação interna</FieldLabel>
                        <Textarea
                          id="admin-observations"
                          rows={2}
                          placeholder="Opcional"
                          className="min-h-16 border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
                          {...form.register('observations')}
                        />
                        <FieldError errors={[errors.observations]} />
                      </Field>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <footer className="shrink-0 border-t border-black bg-card px-4 py-3 lg:px-6">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {isPublished(current) ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFinalizing || isSaving}
                      onClick={() => void onReopen(current.id)}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      {isFinalizing ? 'Reabrindo…' : 'Reabrir registro'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving || isFinalizing}
                    className="border-black"
                    onClick={form.handleSubmit(onSave)}
                  >
                    <FileCheck2Icon data-icon="inline-start" />
                    {isSaving ? 'Salvando…' : 'Salvar rascunho'}
                  </Button>
                  {!isPublished(current) ? (
                    <Button
                      type="button"
                      disabled={isSaving || isFinalizing}
                      onClick={handlePublish}
                    >
                      <SendIcon data-icon="inline-start" />
                      {isFinalizing ? 'Publicando…' : 'Salvar e publicar'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </footer>
          </form>
        ) : (
          <div className="grid min-h-[30rem] place-items-center bg-muted/30 p-8">
            <div className="max-w-md text-center">
              <div className="relative mx-auto grid size-24 place-items-center rounded-xl border border-black bg-card shadow-sm">
                <div className="absolute -right-3 -top-3 grid size-8 place-items-center rounded-full border border-black bg-green-900 text-white shadow-sm">
                  <MapPinIcon className="size-4" />
                </div>
                <PackageIcon className="size-9 text-primary" />
              </div>
              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Comece por uma ação</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Selecione um item da carteira</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O contexto orçamentário e o formulário de entregas aparecerão aqui, prontos para edição e publicação.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CompactFilter({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="mb-0.5 block truncate text-[9px] font-medium text-muted-foreground">{label}</span>
      <span className="block min-w-0">{children}</span>
    </div>
  );
}

function PortfolioMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-16 px-2.5 py-1 text-center">
      <p className="text-sm font-semibold leading-none tabular-nums text-white">
        {value.toLocaleString('pt-BR')}
      </p>
      <p className="mt-0.5 text-[7px] font-semibold uppercase leading-none tracking-[0.11em] text-white/65">{label}</p>
    </div>
  );
}

function AdminDeliveryEditor({
  index,
  form,
  perDeliveryValues,
  canRemove,
  onClear,
  onRemove,
}: {
  index: number;
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  perDeliveryValues: boolean;
  canRemove: boolean;
  onClear: () => void;
  onRemove: () => void;
}) {
  const rowErrors = form.formState.errors.deliveries?.[index];
  const municipality = form.watch(`deliveries.${index}.municipality`);
  const selectedMunicipalities = parseMunicipalitySelection(municipality);

  return (
    <article className="overflow-hidden rounded-lg border border-black bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black bg-green-900 px-3 py-2 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-md border border-black bg-background text-xs font-bold tabular-nums text-foreground">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <p className="text-sm font-semibold">Ficha da entrega</p>
            <p className="text-[11px] text-white/75">Identificação, alcance territorial e público</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white" onClick={onClear} title="Limpar os campos desta entrega">
            <EraserIcon />
            Limpar
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-red-200 hover:bg-white/15 hover:text-red-100" disabled={!canRemove} onClick={onRemove} title={canRemove ? 'Remover entrega' : 'Mantenha ao menos uma entrega'}>
            <Trash2Icon />
            Remover
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-12">
        <Field className="xl:col-span-5" data-invalid={!!rowErrors?.name || undefined}>
          <FieldLabel htmlFor={`admin-delivery-name-${index}`}>Nome da entrega</FieldLabel>
          <Input
            id={`admin-delivery-name-${index}`}
            placeholder="Ex.: Kits escolares distribuídos"
            className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            {...form.register(`deliveries.${index}.name`)}
          />
          <FieldError errors={[rowErrors?.name]} />
        </Field>

        <Field className="xl:col-span-2" data-invalid={!!rowErrors?.quantity || undefined}>
          <FieldLabel htmlFor={`admin-delivery-quantity-${index}`}>Quantidade</FieldLabel>
          <Input
            id={`admin-delivery-quantity-${index}`}
            type="number"
            min={0}
            step={1}
            className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            {...form.register(`deliveries.${index}.quantity`)}
          />
          <FieldError errors={[rowErrors?.quantity]} />
        </Field>

        <Field className="xl:col-span-5" data-invalid={!!rowErrors?.beneficiaries || undefined}>
          <FieldLabel htmlFor={`admin-delivery-beneficiaries-${index}`}>Público beneficiado</FieldLabel>
          <Input
            id={`admin-delivery-beneficiaries-${index}`}
            placeholder="Ex.: Estudantes da rede estadual"
            className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            {...form.register(`deliveries.${index}.beneficiaries`)}
          />
          <FieldError errors={[rowErrors?.beneficiaries]} />
        </Field>

        <Field className={cn(perDeliveryValues ? 'xl:col-span-7' : 'xl:col-span-12')} data-invalid={!!rowErrors?.municipality || undefined}>
          <FieldLabel htmlFor={`admin-delivery-municipality-${index}`}>Municípios alcançados</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={`admin-delivery-municipality-${index}`}
                type="button"
                variant="outline"
                className="h-8 w-full justify-start overflow-hidden border-black bg-background px-2.5 text-left font-normal focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className={cn('truncate', !selectedMunicipalities.length && 'text-muted-foreground')}>
                  {selectedMunicipalities.length ? selectedMunicipalities.join(', ') : 'Selecione um ou mais municípios'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
              <div className="max-h-64 overflow-y-auto">
                {ACRE_MUNICIPALITY_OPTIONS.map((name) => {
                  const checked = selectedMunicipalities.includes(name);
                  return (
                    <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-gray-700 hover:text-white">
                      <Checkbox
                        checked={checked}
                        className="border-black data-[state=checked]:border-gray-900 data-[state=checked]:bg-gray-900"
                        onCheckedChange={(nextChecked) => {
                          const next = nextChecked
                            ? [...selectedMunicipalities, name]
                            : selectedMunicipalities.filter((item) => item !== name);
                          form.setValue(`deliveries.${index}.municipality`, next.join(', '), {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <FieldError errors={[rowErrors?.municipality]} />
        </Field>

        {perDeliveryValues ? (
          <Field className="xl:col-span-5" data-invalid={!!rowErrors?.executedValue || undefined}>
            <FieldLabel htmlFor={`admin-delivery-executed-${index}`}>Valor executado nesta entrega</FieldLabel>
            <Controller
              name={`deliveries.${index}.executedValue`}
              control={form.control}
              render={({ field }) => (
                <MoneyInput
                  id={`admin-delivery-executed-${index}`}
                  value={typeof field.value === 'number' ? field.value : undefined}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
                />
              )}
            />
            <FieldError errors={[rowErrors?.executedValue]} />
          </Field>
        ) : null}

        <Field className="md:col-span-2 xl:col-span-12" data-invalid={!!rowErrors?.description || undefined}>
          <FieldLabel htmlFor={`admin-delivery-description-${index}`}>Descrição do que foi realizado</FieldLabel>
          <Textarea
            id={`admin-delivery-description-${index}`}
            rows={3}
            placeholder="Detalhe o produto, serviço ou atendimento, incluindo o alcance quando relevante."
            className="border-black bg-background focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            {...form.register(`deliveries.${index}.description`)}
          />
          <FieldError errors={[rowErrors?.description]} />
        </Field>
      </div>
    </article>
  );
}
