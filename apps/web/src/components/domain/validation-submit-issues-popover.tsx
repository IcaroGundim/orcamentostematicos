'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ValidationSubmitIssue } from '@/lib/validation-schema';

type ValidationSubmitIssuesPopoverProps = {
  issues: ValidationSubmitIssue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
};

export function ValidationSubmitIssuesPopover({
  issues,
  open,
  onOpenChange,
  align = 'end',
}: ValidationSubmitIssuesPopoverProps) {
  if (issues.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="border-destructive/40 text-destructive">
          <TriangleAlertIcon data-icon="inline-start" />
          Pendências ({issues.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="bottom"
        className="flex w-[min(96vw,28rem)] flex-col gap-3 border-destructive/30 bg-popover p-4 shadow-lg"
      >
        <div className="flex items-start gap-2">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold leading-none text-destructive">Itens pendentes antes do envio</p>
            <p className="text-sm text-muted-foreground">
              Complete os campos abaixo antes de enviar para a SEPLAN.
            </p>
          </div>
        </div>
        <ScrollArea className="max-h-[min(50vh,16rem)] w-full rounded-lg border border-destructive/20 bg-muted">
          <div className="flex flex-col gap-4 p-3 text-sm">
            {issues.map((group) => (
              <div key={group.validationId}>
                <p className="font-medium text-foreground">
                  {group.title}
                  {group.isSelected ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(validação selecionada)</span>
                  ) : null}
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end border-t border-destructive/20 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
