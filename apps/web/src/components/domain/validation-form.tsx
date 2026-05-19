'use client';

import { PackageIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { ACRE_MUNICIPALITY_OPTIONS } from '@/lib/acre-municipalities';
import { blankDelivery, type ValidationFormInput, type ValidationFormValues } from '@/lib/validation-schema';

export type ValidationFormProps = {
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  deliveries: UseFieldArrayReturn<ValidationFormInput, 'deliveries', 'id'>;
  editable: boolean;
  onSave: (values: ValidationFormValues) => void | Promise<void>;
};

export function ValidationForm({ form, deliveries, editable, onSave }: ValidationFormProps) {
  const executionStatus = form.watch('executionStatus');
  const { errors } = form.formState;
  const deliveryFields = deliveries.fields;
  const deliveriesRootError = Array.isArray(errors.deliveries) ? undefined : errors.deliveries;

  return (
    <Card className="mt-0">
      <CardHeader>
        <CardTitle>Formulário de validação</CardTitle>
        <CardDescription>
          Registre as entregas realizadas e complemente com status, valor e observações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => event.preventDefault()}>
          <FieldGroup>
            <FieldSet className="gap-4 rounded-lg border border-border bg-muted/15 p-4">
              <DeliveriesSectionHeader
                count={deliveryFields.length}
                editable={editable}
                onAdd={() => deliveries.append(blankDelivery(deliveryFields.length + 1))}
              />
              <FieldError errors={errors.deliveries?.message ? [errors.deliveries] : undefined} />
              {deliveryFields.length === 0 ? (
                <Empty className="border border-dashed bg-background/60 py-8">
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
                <ul className="flex flex-col gap-4">
                  {deliveryFields.map((field, index) => (
                    <DeliveryItem
                      key={field.id}
                      index={index}
                      editable={editable}
                      canRemove={deliveryFields.length > 1}
                      form={form}
                      onRemove={() => deliveries.remove(index)}
                    />
                  ))}
                </ul>
              )}
            </FieldSet>

            <Separator />

            <FieldSet className="gap-4">
              <FieldLegend variant="legend">Informações complementares</FieldLegend>
              <p className="-mt-2 text-sm text-muted-foreground">
                Status, valores e observações gerais da validação.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <Field data-disabled={!editable || undefined} data-invalid={!!errors.executionStatus || undefined}>
                  <FieldLabel>Status da execução</FieldLabel>
                  <Select
                    value={executionStatus}
                    disabled={!editable}
                    onValueChange={(value) =>
                      form.setValue('executionStatus', value, { shouldValidate: true, shouldDirty: true })
                    }
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
                  <FieldError errors={[errors.executionStatus]} />
                </Field>

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

                <Field data-disabled={!editable || undefined}>
                  <FieldLabel htmlFor="observations">Observações</FieldLabel>
                  <Input id="observations" disabled={!editable} {...form.register('observations')} />
                  <FieldError errors={[errors.observations]} />
                </Field>
              </div>
            </FieldSet>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={!editable} onClick={form.handleSubmit(onSave)}>
                <SaveIcon data-icon="inline-start" />
                Salvar rascunho
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function DeliveriesSectionHeader({
  count,
  editable,
  onAdd,
}: {
  count: number;
  editable: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <FieldLegend variant="legend" className="mb-0">
          Entregas realizadas
        </FieldLegend>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? 'Cadastre quantidade, município e público beneficiado.'
            : `${count} entrega${count !== 1 ? 's' : ''} cadastrada${count !== 1 ? 's' : ''}`}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={!editable} onClick={onAdd}>
        <PlusIcon data-icon="inline-start" />
        Adicionar entrega
      </Button>
    </div>
  );
}

function DeliveryItem({
  index,
  editable,
  canRemove,
  form,
  onRemove,
}: {
  index: number;
  editable: boolean;
  canRemove: boolean;
  form: UseFormReturn<ValidationFormInput, unknown, ValidationFormValues>;
  onRemove: () => void;
}) {
  const { errors } = form.formState;
  const rowErrors = errors.deliveries?.[index];
  const municipality = form.watch(`deliveries.${index}.municipality`);

  return (
    <li className="rounded-lg border border-border bg-background/80 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Field
          className="min-w-0 flex-1"
          data-disabled={!editable || undefined}
          data-invalid={!!rowErrors?.name || undefined}
        >
          <FieldLabel htmlFor={`delivery-name-${index}`}>Nome da entrega</FieldLabel>
          <Input
            id={`delivery-name-${index}`}
            disabled={!editable}
            placeholder="Nome da Entrega"
            {...form.register(`deliveries.${index}.name`)}
          />
          <FieldError errors={[rowErrors?.name]} />
        </Field>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!editable || !canRemove}
          onClick={onRemove}
          title={canRemove ? 'Remover entrega' : 'É necessário manter ao menos uma entrega'}
        >
          <Trash2Icon data-icon="inline-start" />
          Remover
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.description || undefined}>
          <FieldLabel htmlFor={`delivery-description-${index}`}>Descrição</FieldLabel>
          <Textarea
            id={`delivery-description-${index}`}
            disabled={!editable}
            rows={2}
            {...form.register(`deliveries.${index}.description`)}
          />
          <FieldError errors={[rowErrors?.description]} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.quantity || undefined}>
            <FieldLabel htmlFor={`delivery-quantity-${index}`}>Quantidade</FieldLabel>
            <Input
              id={`delivery-quantity-${index}`}
              disabled={!editable}
              type="number"
              min={0}
              step={1}
              {...form.register(`deliveries.${index}.quantity`)}
            />
            <FieldError errors={[rowErrors?.quantity]} />
          </Field>

          <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.municipality || undefined}>
            <FieldLabel htmlFor={`delivery-municipality-${index}`}>Município</FieldLabel>
            <Select
              value={municipality || undefined}
              disabled={!editable}
              onValueChange={(value) =>
                form.setValue(`deliveries.${index}.municipality`, value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id={`delivery-municipality-${index}`} className="w-full">
                <SelectValue placeholder="Selecione o município" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ACRE_MUNICIPALITY_OPTIONS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError errors={[rowErrors?.municipality]} />
          </Field>

          <Field data-disabled={!editable || undefined} data-invalid={!!rowErrors?.beneficiaries || undefined}>
            <FieldLabel htmlFor={`delivery-beneficiaries-${index}`}>Público beneficiado</FieldLabel>
            <Input
              id={`delivery-beneficiaries-${index}`}
              disabled={!editable}
              placeholder="Ex.: Estudantes da rede pública de ensino"
              {...form.register(`deliveries.${index}.beneficiaries`)}
            />
            <FieldError errors={[rowErrors?.beneficiaries]} />
          </Field>
        </div>
      </div>
    </li>
  );
}
