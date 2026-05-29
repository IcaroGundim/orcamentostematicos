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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <Select
          value={functionFilter}
          onValueChange={(value) => {
            onFunctionChange(value);
            onSubfunctionChange(allValue);
          }}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Todas as funções" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {functionOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5">
        {showLabels ? <FieldLabel className={filterFieldLabelClass}>Subfunção</FieldLabel> : null}
        <Select
          value={subfunctionFilter}
          onValueChange={onSubfunctionChange}
          disabled={subfunctionDisabled}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Todas as subfunções" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {subfunctionOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );

  if (!showLabels) {
    return <div className={cn('flex flex-wrap items-center gap-2', className)}>{fields}</div>;
  }

  return <div className={cn('contents', className)}>{fields}</div>;
}
