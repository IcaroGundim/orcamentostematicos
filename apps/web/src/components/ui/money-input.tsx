'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { formatMoneyInput, parseMoneyInput } from '@/lib/money-input';
import { cn } from '@/lib/utils';

export type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  value?: number | null;
  onValueChange?: (value: number | undefined) => void;
};

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { className, value, onValueChange, onBlur, disabled, placeholder = 'R$ 0,00', ...props },
  ref,
) {
  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={formatMoneyInput(value)}
      onChange={(event) => {
        onValueChange?.(parseMoneyInput(event.target.value));
      }}
      onBlur={onBlur}
      className={cn('tabular-nums', className)}
    />
  );
});

export { MoneyInput };
