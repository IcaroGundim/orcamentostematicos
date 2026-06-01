'use client';

import { useMemo } from 'react';

import {
  buildFunctionFilterOptions,
  buildSubfunctionFilterOptions,
} from '@/lib/functional-classification';
import type { BudgetAction } from '@/types/domain';
import { cn } from '@/lib/utils';
import { filterFieldLabelClass } from '@/components/domain/filter-field-styles';
import { Field, FieldLabel } from '@/components/ui/field';
import { SearchableCombobox } from '@/components/domain/searchable-combobox';

export type FunctionalClassificationFiltersProps = {
  actions: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>[];
  functionFilter: string;
  subfunctionFilter: string;
  onFunctionChange: (value: string) => void;
  onSubfunctionChange: (value: string) => void;
  allValue: string;
  className?: string;
  showLabels?: boolean;
};

export function FunctionalClassificationFilters({
  actions,
  functionFilter,
  subfunctionFilter,
  onFunctionChange,
  onSubfunctionChange,
  allValue,
  className,
  showLabels = true,
}: FunctionalClassificationFiltersProps) {
  const functionOptions = useMemo(
    () => buildFunctionFilterOptions(actions, allValue),
    [actions, allValue],
  );

  const subfunctionOptions = useMemo(
    () => buildSubfunctionFilterOptions(actions, functionFilter, allValue),
    [actions, functionFilter, allValue],
  );

  const subfunctionDisabled = subfunctionOptions.length <= 1;

  const fields = (
    <>
      <Field className="min-w-0 gap-1.5">
        {showLabels ? <FieldLabel className={filterFieldLabelClass}>Função</FieldLabel> : null}
        <SearchableCombobox
          className="relative w-full min-w-0"
          value={functionFilter}
          onChange={(value) => {
            onFunctionChange(value);
            onSubfunctionChange(allValue);
          }}
          placeholder="Todas as funções"
          items={functionOptions}
        />
      </Field>
      <Field className="min-w-0 gap-1.5">
        {showLabels ? <FieldLabel className={filterFieldLabelClass}>Subfunção</FieldLabel> : null}
        <SearchableCombobox
          className="relative w-full min-w-0"
          value={subfunctionFilter}
          onChange={onSubfunctionChange}
          disabled={subfunctionDisabled}
          placeholder="Todas as subfunções"
          items={subfunctionOptions}
        />
      </Field>
    </>
  );

  if (!showLabels) {
    return <div className={cn('flex flex-wrap items-center gap-2', className)}>{fields}</div>;
  }

  return <div className={cn('contents', className)}>{fields}</div>;
}
