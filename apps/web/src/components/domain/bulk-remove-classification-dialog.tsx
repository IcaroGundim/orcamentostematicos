'use client';

import { useMemo, useState } from 'react';
import { RefreshCwIcon, Trash2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { themeLabels } from '@/lib/api';
import type { BulkRemoveThemeFilter } from '@/lib/curation-actions';
import type { BudgetAction, ThemeBudget } from '@/types/domain';

export type BulkRemoveClassificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedActions: BudgetAction[];
  isRemoving: boolean;
  onConfirm: (themeFilter: BulkRemoveThemeFilter) => void | Promise<void>;
};

export function BulkRemoveClassificationDialog({
  open,
  onOpenChange,
  selectedActions,
  isRemoving,
  onConfirm,
}: BulkRemoveClassificationDialogProps) {
  const [mode, setMode] = useState<'ALL' | 'THEME'>('ALL');
  const [themeFilter, setThemeFilter] = useState<ThemeBudget>('OCAD');

  const preview = useMemo(() => {
    const rows = selectedActions.map((action) => {
      const assignments =
        mode === 'ALL'
          ? action.assignments
          : action.assignments.filter((item) => item.theme === themeFilter);
      return { action, assignments };
    });
    const assignmentCount = rows.reduce((sum, row) => sum + row.assignments.length, 0);
    const actionCount = rows.filter((row) => row.assignments.length > 0).length;
    return { rows: rows.filter((row) => row.assignments.length > 0), assignmentCount, actionCount };
  }, [mode, selectedActions, themeFilter]);

  const effectiveFilter: BulkRemoveThemeFilter = mode === 'ALL' ? 'ALL' : themeFilter;

  function handleOpenChange(next: boolean) {
    if (!next && isRemoving) return;
    if (!next) {
      setMode('ALL');
      setThemeFilter('OCAD');
    }
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[min(92vh,40rem)] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <AlertDialogHeader className="shrink-0">
          <AlertDialogTitle>Remover classificações em lote</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedActions.length} ação(ões) selecionada(s). Validações de execução com dados
            preenchidos pela secretaria impedem a remoção; a operação pode ser parcial.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <Field className="gap-3">
            <FieldLabel>Escopo da remoção</FieldLabel>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-checked:border-primary has-checked:bg-primary/5">
                <input
                  type="radio"
                  name="bulk-remove-mode"
                  className="mt-0.5 size-4 accent-primary"
                  checked={mode === 'ALL'}
                  disabled={isRemoving}
                  onChange={() => setMode('ALL')}
                />
                <span className="text-sm leading-snug">
                  <span className="font-medium">Todas as classificações</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Remove todos os temas de cada ação selecionada.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-checked:border-primary has-checked:bg-primary/5">
                <input
                  type="radio"
                  name="bulk-remove-mode"
                  className="mt-0.5 size-4 accent-primary"
                  checked={mode === 'THEME'}
                  disabled={isRemoving}
                  onChange={() => setMode('THEME')}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-snug">
                  <span className="font-medium">Apenas um tema</span>
                  <Select
                    value={themeFilter}
                    disabled={isRemoving || mode !== 'THEME'}
                    onValueChange={(value) => setThemeFilter(value as ThemeBudget)}
                  >
                    <SelectTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {(Object.keys(themeLabels) as ThemeBudget[]).map((theme) => (
                          <SelectItem key={theme} value={theme}>
                            {themeLabels[theme]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </span>
              </label>
            </div>
          </Field>

          <p className="text-sm text-muted-foreground">
            Serão removidas{' '}
            <span className="font-medium text-foreground">{preview.assignmentCount}</span>{' '}
            classificação(ões) em{' '}
            <span className="font-medium text-foreground">{preview.actionCount}</span> ação(ões).
          </p>

          {preview.rows.length > 0 ? (
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/15 p-2 text-sm">
              {preview.rows.map(({ action, assignments }) => (
                <li key={action.id} className="rounded-md border border-border/60 bg-background/60 p-2">
                  <p className="font-medium tabular-nums">{action.projectActivity}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{action.application}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {assignments.map((item) => themeLabels[item.theme]).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma classificação elegível para o escopo escolhido.
            </p>
          )}
        </div>

        <AlertDialogFooter className="shrink-0 border-t pt-4">
          <AlertDialogCancel disabled={isRemoving}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isRemoving || preview.assignmentCount === 0}
            onClick={() => void onConfirm(effectiveFilter)}
          >
            {isRemoving ? (
              <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            Confirmar remoção
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
