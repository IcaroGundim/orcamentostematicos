'use client';

import { EraserIcon, PackageIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { Controller, useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/api';
import {
  ACRE_MUNICIPALITY_OPTIONS,
  parseMunicipalitySelection,
} from '@/lib/acre-municipalities';
import { sumDeliveryExecutedValues, usesDeliveryValues } from '@/lib/classification-rules';
import { blankDelivery, type ValidationFormInput, type ValidationFormValues } from '@/lib/validation-schema';
import type { ThemeBudget } from '@/types/domain';

export type ValidationFormProps = {
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  deliveries: UseFieldArrayReturn<ValidationFormInput, 'deliveries', 'id'>;
  theme: ThemeBudget | string;
  classification: string;
  editable: boolean;
  programName?: string;
  onSave: (values: ValidationFormValues) => void | Promise<void>;
  isSaving?: boolean;
};

export function ValidationForm({ form, deliveries, theme, classification, editable, programName, onSave, isSaving = false }: ValidationFormProps) {
  const watchedDeliveries = useWatch({ control: form.control, name: 'deliveries' });
  const perDeliveryValues = usesDeliveryValues(theme, classification);
  const deliveryTotal = useMemo(
    () => sumDeliveryExecutedValues(watchedDeliveries ?? []),
    [watchedDeliveries],
  );
  const { errors } = form.formState;
  const deliveryFields = deliveries.fields;

  const clearDelivery = (index: number) => {
    const options = { shouldValidate: false, shouldDirty: true } as const;
    const currentDelivery = form.getValues(`deliveries.${index}`);
    form.setValue(
      `deliveries.${index}`,
      {
        ...currentDelivery,
        name: '',
        description: '',
        quantity: 0,
        municipality: '',
        beneficiaries: '',
        executedValue: null,
      },
      options,
    );
    form.clearErrors(`deliveries.${index}`);
  };

  return (
    <Card size="sm" className="mt-0">
      <CardHeader>
        <CardTitle>Formulário de validação</CardTitle>
        <CardDescription>
          Registre as entregas realizadas e complemente com status, valor e observações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <SectionHeader
              eyebrow="Etapa 1"
              title={
                programName ? (
                  <>
                    Entregas Realizadas no Programa:{' '}
                    <span className="text-primary">{programName}</span>
                  </>
                ) : (
                  'Entregas realizadas'
                )
              }
              hint={
                deliveryFields.length === 0
                  ? perDeliveryValues
                    ? 'Cadastre quantidade, município, público e valor executado de cada entrega.'
                    : 'Cadastre quantidade, município e público beneficiado.'
                  : `${deliveryFields.length} entrega${deliveryFields.length !== 1 ? 's' : ''} cadastrada${deliveryFields.length !== 1 ? 's' : ''}`
              }
            />
            <FieldError errors={errors.deliveries?.message ? [errors.deliveries] : undefined} />

            {deliveryFields.length === 0 ? (
              <Empty className="border border-dashed py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma entrega cadastrada</EmptyTitle>
                  <EmptyDescription>
                    Adicione a primeira entrega para documentar o que foi realizado nesta ação.
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => deliveries.append(blankDelivery(deliveryFields.length + 1))}
                >
                  <PlusIcon data-icon="inline-start" />
                  Adicionar primeira entrega
                </Button>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {deliveryFields.map((field, index) => (
                  <DeliveryItem
                    key={field.id}
                    index={index}
                    editable={editable}
                    canRemove={deliveryFields.length > 1}
                    perDeliveryValues={perDeliveryValues}
                    form={form}
                    onRemove={() => deliveries.remove(index)}
                    onClear={() => clearDelivery(index)}
                  />
                ))}
                <li>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center border-2 border-dashed border-foreground/30 py-5 text-sm font-semibold text-foreground hover:border-foreground/60 hover:bg-muted/50"
                    disabled={!editable}
                    onClick={() => deliveries.append(blankDelivery(deliveryFields.length + 1))}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Adicionar outra entrega
                  </Button>
                </li>
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t pt-4">
            <SectionHeader
              eyebrow="Etapa 2"
              title="Informações complementares"
              hint="Status, valores e observações gerais da validação."
            />

            <div className="grid gap-3 md:grid-cols-2">
              {perDeliveryValues ? (
                <Field>
                  <FieldLabel>Total das entregas</FieldLabel>
                  <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-semibold tabular-nums">
                    {formatMoney(deliveryTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Soma automática dos valores informados em cada entrega.
                  </p>
                </Field>
              ) : (
                <Field data-disabled={!editable || undefined} data-invalid={!!errors.informedExecutedValue || undefined}>
                  <FieldLabel htmlFor="executedValue">Valor executado informado</FieldLabel>
                  <Input
                    id="executedValue"
                    disabled={!editable}
                    type="number"
                    step="0.01"
                    {...form.register('informedExecutedValue')}
                  />
                  <FieldError errors={[errors.informedExecutedValue]} />
                </Field>
              )}

              <Field data-disabled={!editable || undefined}>
                <FieldLabel htmlFor="observations">Observações</FieldLabel>
                <Input id="observations" disabled={!editable} {...form.register('observations')} />
                <FieldError errors={[errors.observations]} />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" disabled={!editable || isSaving} onClick={form.handleSubmit(onSave)}>
              <SaveIcon data-icon="inline-start" />
              {isSaving ? 'Salvando…' : 'Salvar rascunho'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </span>
        <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {action}
    </header>
  );
}

function DeliveryItem({
  index,
  editable,
  canRemove,
  perDeliveryValues,
  form,
  onRemove,
  onClear,
}: {
  index: number;
  editable: boolean;
  canRemove: boolean;
  perDeliveryValues: boolean;
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  onRemove: () => void;
  onClear: () => void;
}) {
  const { errors } = form.formState;
  const rowErrors = errors.deliveries?.[index];
  const municipality = form.watch(`deliveries.${index}.municipality`);
  const selectedMunicipalities = parseMunicipalitySelection(municipality);

  return (
    <li className="overflow-hidden rounded-lg border border-black bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-black bg-green-900 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-black bg-background px-1.5 text-xs font-bold tabular-nums text-foreground">
            {index + 1}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            Entrega
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-white hover:bg-white/15 hover:text-white"
            disabled={!editable}
            onClick={onClear}
            title="Limpar os campos preenchidos desta entrega"
          >
            <EraserIcon className="size-4" data-icon="inline-start" />
            Limpar campos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-red-200 hover:bg-white/15 hover:text-red-100"
            disabled={!editable || !canRemove}
            onClick={onRemove}
            title={canRemove ? 'Remover entrega' : 'É necessário manter ao menos uma entrega'}
          >
            <Trash2Icon className="size-4" data-icon="inline-start" />
            Remover
          </Button>
        </div>
      </header>

      <div className="grid gap-3 p-3 md:grid-cols-4">
        <Field
          data-disabled={!editable || undefined}
          data-invalid={!!rowErrors?.name || undefined}
        >
          <FieldLabel htmlFor={`delivery-name-${index}`}>Nome da entrega</FieldLabel>
          <Input
            id={`delivery-name-${index}`}
            className="border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            disabled={!editable}
            placeholder="Nome da Entrega"
            {...form.register(`deliveries.${index}.name`)}
          />
          <FieldError errors={[rowErrors?.name]} />
        </Field>

        <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.quantity || undefined}>
          <FieldLabel htmlFor={`delivery-quantity-${index}`}>Quantidade</FieldLabel>
          <Input
            id={`delivery-quantity-${index}`}
            className="border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            disabled={!editable}
            type="number"
            min={0}
            step={1}
            {...form.register(`deliveries.${index}.quantity`)}
          />
          <FieldError errors={[rowErrors?.quantity]} />
        </Field>

        <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.municipality || undefined}>
          <FieldLabel htmlFor={`delivery-municipality-${index}`}>Municípios</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={`delivery-municipality-${index}`}
                type="button"
                variant="outline"
                disabled={!editable}
                className="h-8 w-full justify-start overflow-hidden border-black bg-background px-3 text-left font-normal focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                <span className="truncate">
                  {selectedMunicipalities.length
                    ? selectedMunicipalities.join(', ')
                    : 'Selecione os municípios'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
              <div className="max-h-64 overflow-y-auto">
                {ACRE_MUNICIPALITY_OPTIONS.map((name) => {
                  const checked = selectedMunicipalities.includes(name);
                  return (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-gray-700 hover:text-white"
                    >
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

        <Field
          data-disabled={!editable || undefined}
          data-invalid={!!rowErrors?.beneficiaries || undefined}
        >
          <FieldLabel htmlFor={`delivery-beneficiaries-${index}`}>Público beneficiado</FieldLabel>
          <Input
            id={`delivery-beneficiaries-${index}`}
            className="border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            disabled={!editable}
            placeholder="Ex.: Estudantes da rede pública de ensino"
            {...form.register(`deliveries.${index}.beneficiaries`)}
          />
          <FieldError errors={[rowErrors?.beneficiaries]} />
        </Field>

        <Field
          className="md:col-span-4"
          data-disabled={!editable || undefined}
          data-invalid={!!rowErrors?.description || undefined}
        >
          <FieldLabel htmlFor={`delivery-description-${index}`}>
            Descrição{' '}
            <span className="font-normal text-muted-foreground">
              (descreva detalhadamente o que foi executado — ex.: "Distribuição de 500 cestas básicas a famílias em situação de vulnerabilidade nos bairros X e Y")
            </span>
          </FieldLabel>
          <Textarea
            id={`delivery-description-${index}`}
            className="border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
            disabled={!editable}
            rows={2}
            {...form.register(`deliveries.${index}.description`)}
          />
          <FieldError errors={[rowErrors?.description]} />
        </Field>

        {perDeliveryValues ? (
          <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.executedValue || undefined}>
            <FieldLabel htmlFor={`delivery-executed-value-${index}`}>Valor Executado na Ação</FieldLabel>
            <Controller
              name={`deliveries.${index}.executedValue`}
              control={form.control}
              render={({ field }) => (
                <MoneyInput
                  id={`delivery-executed-value-${index}`}
                  className="border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300"
                  name={field.name}
                  disabled={!editable}
                  value={typeof field.value === 'number' ? field.value : undefined}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <FieldError errors={[rowErrors?.executedValue]} />
          </Field>
        ) : null}
      </div>
    </li>
  );
}
