/** Estilos compartilhados entre Select (Radix) e SearchableCombobox. */
export const dropdownTriggerClassName =
  'group/trigger flex h-8 w-full min-h-8 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm md:h-9 md:py-2 transition-[color,box-shadow,background-color,border-color] outline-none select-none hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-ring data-[state=open]:bg-muted/40 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 dark:data-[state=open]:bg-input/50';

export const dropdownTriggerFocusWithinClassName =
  'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50';

export const dropdownContentClassName =
  'z-50 max-h-[min(24rem,var(--radix-select-content-available-height,24rem))] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';

export const dropdownContentPopperClassName =
  'w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width) max-w-[min(100vw-1rem,var(--radix-select-trigger-width))]';

export const dropdownViewportClassName =
  'max-h-[min(20rem,var(--radix-select-content-available-height,20rem))] w-full scroll-py-1 overflow-y-auto overscroll-contain p-0.5';

export const dropdownItemClassName =
  'relative flex w-full cursor-default items-center gap-2 rounded-md py-2 pr-8 pl-2.5 text-left text-sm outline-none select-none transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground data-[state=checked]:bg-accent/15 data-[state=checked]:font-medium data-[state=checked]:text-foreground';

export const dropdownItemIndicatorClassName =
  'pointer-events-none absolute right-2.5 flex size-4 items-center justify-center text-primary';

export const dropdownEmptyClassName =
  'px-3 py-6 text-center text-sm text-muted-foreground';

export const dropdownChevronClassName =
  'pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180';
