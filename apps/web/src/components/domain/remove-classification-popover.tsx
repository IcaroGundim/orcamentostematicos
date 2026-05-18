'use client';

import type { ReactNode } from 'react';
import { RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { themeLabels } from '@/lib/api';
import type { BudgetAction, Metadata, ThematicAssignment } from '@/types/domain';

export type RemoveClassificationPopoverProps = {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: Metadata | null;
  selectedAction: BudgetAction | null;
  selectedAssignmentIds: string[];
  onSelectedAssignmentIdsChange: (ids: string[]) => void;
  isRemovingAssignment: boolean;
  onConfirmRemove: () => void;
};

export function RemoveClassificationPopover({
  children,
  open,
  onOpenChange,
  metadata,
  selectedAction,
  selectedAssignmentIds,
  onSelectedAssignmentIdsChange,
  isRemovingAssignment,
  onConfirmRemove,
}: RemoveClassificationPopoverProps) {
  const assignments = selectedAction?.assignments ?? [];
  const assignmentIds = assignments.map((a) => a.id);
  const selectedSet = new Set(selectedAssignmentIds);

  function handleOpenChange(next: boolean) {
    if (!next && isRemovingAssignment) return;
    onOpenChange(next);
  }

  function toggleId(id: string, checked: boolean) {
    if (checked) {
      if (selectedSet.has(id)) return;
      onSelectedAssignmentIdsChange([...selectedAssignmentIds, id]);
    } else {
      onSelectedAssignmentIdsChange(selectedAssignmentIds.filter((x) => x !== id));
    }
  }

  const summaryRows = assignments.filter((a) => selectedSet.has(a.id));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="flex w-[min(96vw,28rem)] flex-col gap-3 p-4"
      >
        <div className="space-y-1 shrink-0">
          <p className="font-semibold leading-none">Remover classificações</p>
          <p className="text-sm text-muted-foreground">
            Marque uma ou mais classificações (até três temas por ação). Se já existirem validações de execução ligadas a alguma delas, o sistema impedirá a remoção e exibirá o motivo.
          </p>
        </div>

        {assignments.length > 0 ? (
          <Field className="gap-2 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel className="mb-0">Classificações a remover</FieldLabel>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  disabled={isRemovingAssignment || assignmentIds.length === 0}
                  onClick={() => onSelectedAssignmentIdsChange([...assignmentIds])}
                >
                  Marcar todas
                </button>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  disabled={isRemovingAssignment || selectedAssignmentIds.length === 0}
                  onClick={() => onSelectedAssignmentIdsChange([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto rounded-md border bg-muted/15 p-2">
              {assignments.map((item) => {
                const checked = selectedSet.has(item.id);
                const checkboxId = `remove-assignment-${item.id}`;
                return (
                  <li key={item.id} className="flex items-start gap-2">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={checked}
                      disabled={isRemovingAssignment}
                      className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                      onChange={(e) => toggleId(item.id, e.target.checked)}
                    />
                    <Label htmlFor={checkboxId} className="cursor-pointer font-normal leading-snug">
                      <span className="font-medium">{themeLabels[item.theme]}</span>
                      {' · '}
                      {lookupClassificationLabel(metadata, item.theme, item.classification)}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </Field>
        ) : null}

        <ScrollArea className="h-[min(40vh,16rem)] min-h-0 w-full shrink-0 overflow-hidden rounded-lg border bg-muted/20">
          <div className="space-y-3 p-3 text-sm">
            {summaryRows.length === 0 ? (
              <p className="text-muted-foreground">Marque ao menos uma classificação para rever os detalhes e confirmar.</p>
            ) : selectedAction ? (
              summaryRows.map((pendingRow) => (
                <div
                  key={pendingRow.id}
                  className="space-y-2 rounded-md border border-border bg-background/40 p-2.5 last:pb-2"
                >
                  <p>
                    <span className="text-muted-foreground">Ação: </span>
                    <span className="font-medium tabular-nums">{selectedAction.projectActivity}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="leading-snug">{selectedAction.application}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tema: </span>
                    <span className="font-medium">{themeLabels[pendingRow.theme]}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Eixo: </span>
                    {lookupAxisLabel(metadata, pendingRow.theme, pendingRow.axis)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Classificação: </span>
                    {lookupClassificationLabel(metadata, pendingRow.theme, pendingRow.classification)}
                  </p>
                  {pendingRow.weightingFactor !== undefined && pendingRow.weightingFactor !== null ? (
                    <p>
                      <span className="text-muted-foreground">Ponderador: </span>
                      <span className="tabular-nums">{formatWeightingFactor(pendingRow.weightingFactor)}</span>
                    </p>
                  ) : null}
                  {pendingRow.justification?.trim() ? (
                    <p className="border-t pt-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Justificativa: </span>
                      <span className="block whitespace-pre-wrap">{pendingRow.justification.trim()}</span>
                    </p>
                  ) : null}
                </div>
              ))
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={isRemovingAssignment}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isRemovingAssignment || selectedAssignmentIds.length === 0}
            onClick={() => void onConfirmRemove()}
          >
            {isRemovingAssignment ? (
              <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            Confirmar remoção
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function lookupAxisLabel(meta: Metadata | null, theme: ThematicAssignment['theme'], code: string) {
  const list = meta?.axes[theme] ?? [];
  return list.find((item) => item.value === code)?.label ?? code;
}

function lookupClassificationLabel(meta: Metadata | null, theme: ThematicAssignment['theme'], code: string) {
  const list = meta?.classifications[theme] ?? [];
  return list.find((item) => item.value === code)?.label ?? code;
}

function formatWeightingFactor(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}
