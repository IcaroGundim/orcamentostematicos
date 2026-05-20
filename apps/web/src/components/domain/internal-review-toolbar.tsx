'use client';

import { CheckIcon, RefreshCwIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';
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
import type { ValidationItem } from '@/types/domain';

type InternalReviewToolbarProps = {
  validation: ValidationItem;
  isReviewing: boolean;
  onApprove: (id: string) => void | Promise<void>;
  onReturn: (id: string, comment: string) => void | Promise<void>;
};

export function InternalReviewToolbar({
  validation,
  isReviewing,
  onApprove,
  onReturn,
}: InternalReviewToolbarProps) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');

  if (validation.status !== 'ENVIADO_REVISOR') return null;

  async function confirmReturn() {
    const comment = returnComment.trim();
    if (!comment) return;
    setReturnDialogOpen(false);
    await onReturn(validation.id, comment);
    setReturnComment('');
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Revisão da validação selecionada"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        <Button
          size="sm"
          variant="default"
          disabled={isReviewing}
          onClick={() => void onApprove(validation.id)}
        >
          {isReviewing ? (
            <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <CheckIcon data-icon="inline-start" />
          )}
          Aprovar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isReviewing}
          onClick={() => setReturnDialogOpen(true)}
        >
          {isReviewing ? (
            <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <Undo2Icon data-icon="inline-start" />
          )}
          Devolver
        </Button>
      </div>

      <AlertDialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) setReturnComment('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver validação para correção</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da devolução. O técnico receberá esta observação para ajustar a validação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="internalReturnComment"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Observações / Justificativa da Devolução
            </label>
            <Textarea
              id="internalReturnComment"
              placeholder="Descreva o que precisa ser corrigido..."
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!returnComment.trim() || isReviewing}
              onClick={() => void confirmReturn()}
            >
              Devolver
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
