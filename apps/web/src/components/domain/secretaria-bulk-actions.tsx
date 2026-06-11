'use client';

import { RefreshCwIcon, SendIcon } from 'lucide-react';
import { ValidationSubmitIssuesPopover } from '@/components/domain/validation-submit-issues-popover';
import { Button } from '@/components/ui/button';
import type { ValidationSubmitIssue } from '@/lib/validation-schema';
import type { ValidationItem } from '@/types/domain';

const SUBMIT_STATUSES = ['RASCUNHO', 'DEVOLVIDO'] as const;

type SecretariaBulkActionsProps = {
  validations: ValidationItem[];
  isSubmittingAll: boolean;
  submitIssues: ValidationSubmitIssue[];
  submitIssuesOpen: boolean;
  onSubmitIssuesOpenChange: (open: boolean) => void;
  onSubmitSeplan: () => void;
};

function withCount(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : label;
}

export function SecretariaBulkActions({
  validations,
  isSubmittingAll,
  submitIssues,
  submitIssuesOpen,
  onSubmitIssuesOpenChange,
  onSubmitSeplan,
}: SecretariaBulkActionsProps) {
  const seplanCount = validations.filter((v) =>
    (SUBMIT_STATUSES as readonly string[]).includes(v.status),
  ).length;

  return (
    <div
      role="toolbar"
      aria-label="Ações em lote"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      <Button size="sm" variant="default" disabled={isSubmittingAll || seplanCount === 0} onClick={() => onSubmitSeplan()}>
        {isSubmittingAll ? (
          <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <SendIcon data-icon="inline-start" />
        )}
        {isSubmittingAll ? 'Enviando...' : withCount('Enviar para SEPLAN', seplanCount)}
      </Button>
      <ValidationSubmitIssuesPopover
        issues={submitIssues}
        open={submitIssuesOpen}
        onOpenChange={onSubmitIssuesOpenChange}
      />
    </div>
  );
}
