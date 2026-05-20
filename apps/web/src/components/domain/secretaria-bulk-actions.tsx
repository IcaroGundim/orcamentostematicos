'use client';

import { CheckIcon, RefreshCwIcon, SendIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';
import { ValidationSubmitIssuesPopover } from '@/components/domain/validation-submit-issues-popover';
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
import { Textarea } from '@/components/ui/textarea';
import type { ValidationSubmitIssue } from '@/lib/validation-schema';
import type { ValidationItem } from '@/types/domain';

const INTERNAL_SUBMIT_STATUSES = ['RASCUNHO', 'DEVOLVIDO', 'DEVOLVIDO_REVISOR'] as const;
const SEPLAN_SUBMIT_STATUSES = ['APROVADO_REVISOR'] as const;
const REVIEW_STATUSES = ['ENVIADO_REVISOR'] as const;

type SecretariaBulkActionsProps = {
  role: 'REPRESENTANTE' | 'REVISOR';
  validations: ValidationItem[];
  isSubmittingAll: boolean;
  isReviewingAll: boolean;
  submitIssues: ValidationSubmitIssue[];
  submitIssuesOpen: boolean;
  onSubmitIssuesOpenChange: (open: boolean) => void;
  onSubmitInternal: () => void;
  onSubmitSeplan: () => void;
  onReviewAll: (approve: boolean, comment?: string) => void | Promise<void>;
};

function withCount(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : label;
}

export function SecretariaBulkActions({
  role,
  validations,
  isSubmittingAll,
  isReviewingAll,
  submitIssues,
  submitIssuesOpen,
  onSubmitIssuesOpenChange,
  onSubmitInternal,
  onSubmitSeplan,
  onReviewAll,
}: SecretariaBulkActionsProps) {
  const [bulkReturnOpen, setBulkReturnOpen] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkReturnComment, setBulkReturnComment] = useState('');

  if (role === 'REPRESENTANTE') {
    const internalCount = validations.filter((v) =>
      (INTERNAL_SUBMIT_STATUSES as readonly string[]).includes(v.status),
    ).length;
    const seplanCount = validations.filter((v) =>
      (SEPLAN_SUBMIT_STATUSES as readonly string[]).includes(v.status),
    ).length;

    return (
      <div
        role="toolbar"
        aria-label="Ações em lote"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        <Button
          size="sm"
          variant="secondary"
          disabled={isSubmittingAll || internalCount === 0}
          onClick={() => onSubmitInternal()}
        >
          {isSubmittingAll ? (
            <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <SendIcon data-icon="inline-start" />
          )}
          {isSubmittingAll ? 'Enviando...' : withCount('Enviar para Revisão Interna', internalCount)}
        </Button>
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

  const reviewCount = validations.filter((v) => (REVIEW_STATUSES as readonly string[]).includes(v.status)).length;

  async function confirmBulkReturn() {
    const comment = bulkReturnComment.trim();
    if (!comment) return;
    setBulkReturnOpen(false);
    setBulkReturnComment('');
    await onReviewAll(false, comment);
  }

  async function confirmBulkApprove() {
    setBulkApproveOpen(false);
    await onReviewAll(true);
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Ações em lote"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        <Button
          size="sm"
          variant="destructive"
          disabled={isReviewingAll || reviewCount === 0}
          onClick={() => setBulkReturnOpen(true)}
        >
          {isReviewingAll ? (
            <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <Undo2Icon data-icon="inline-start" />
          )}
          {withCount('Devolver para Correção', reviewCount)}
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={isReviewingAll || reviewCount === 0}
          onClick={() => setBulkApproveOpen(true)}
        >
          {isReviewingAll ? (
            <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <CheckIcon data-icon="inline-start" />
          )}
          {withCount('Aprovar Tudo', reviewCount)}
        </Button>
      </div>

      <AlertDialog
        open={bulkReturnOpen}
        onOpenChange={(open) => {
          setBulkReturnOpen(open);
          if (!open) setBulkReturnComment('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver validações para correção</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewCount > 0
                ? `Informe o motivo da devolução para ${reviewCount} validação(ões) aguardando revisão interna.`
                : 'Nenhuma validação pendente de revisão.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulkReturnComment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Observações / Justificativa da Devolução
            </label>
            <Textarea
              id="bulkReturnComment"
              placeholder="Descreva o que precisa ser corrigido..."
              value={bulkReturnComment}
              onChange={(e) => setBulkReturnComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={!bulkReturnComment.trim() || isReviewingAll} onClick={() => void confirmBulkReturn()}>
              Devolver
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkApproveOpen} onOpenChange={setBulkApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar todas as validações?</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewCount > 0
                ? `Serão aprovadas ${reviewCount} validação(ões). O envio à SEPLAN é feito posteriormente pelo representante.`
                : 'Nenhuma validação pendente de revisão.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="default" disabled={reviewCount === 0 || isReviewingAll} onClick={() => void confirmBulkApprove()}>
              Aprovar Tudo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
