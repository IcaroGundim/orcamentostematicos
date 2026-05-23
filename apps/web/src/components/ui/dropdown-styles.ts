/** Estilos compartilhados entre Select (Radix) e SearchableCombobox. */
export const dropdownTriggerClassName =
  'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50';

export const dropdownTriggerFocusWithinClassName =
  'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50';

export const dropdownContentClassName =
  'z-50 max-h-[32rem] overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10';

export const dropdownContentPopperClassName =
  'w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)';

export const dropdownItemClassName =
  'relative flex w-full cursor-default items-center rounded-md py-1 pr-8 pl-1.5 text-left text-sm outline-none select-none hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground';

export const dropdownItemIndicatorClassName =
  'pointer-events-none absolute right-2 flex size-4 items-center justify-center';

export const dropdownEmptyClassName =
  'px-2 py-2 text-center text-sm text-muted-foreground';
