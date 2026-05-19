import { useCallback } from 'react';
import type { ValidationFormInput } from '@/lib/validation-schema';

const drafts = new Map<string, ValidationFormInput>();

function cloneDraft(values: ValidationFormInput): ValidationFormInput {
  return JSON.parse(JSON.stringify(values)) as ValidationFormInput;
}

export function getValidationDraft(validationId: string): ValidationFormInput | undefined {
  const draft = drafts.get(validationId);
  return draft ? cloneDraft(draft) : undefined;
}

export function setValidationDraft(validationId: string, values: ValidationFormInput) {
  drafts.set(validationId, cloneDraft(values));
}

export function clearValidationDraft(validationId: string) {
  drafts.delete(validationId);
}

export function clearAllValidationDrafts() {
  drafts.clear();
}

export function useValidationDraftCache() {
  return {
    saveDraft: useCallback((validationId: string, values: ValidationFormInput) => {
      setValidationDraft(validationId, values);
    }, []),
    getDraft: useCallback((validationId: string) => getValidationDraft(validationId), []),
    clearDraft: useCallback((validationId: string) => clearValidationDraft(validationId), []),
    clearAllDrafts: useCallback(() => clearAllValidationDrafts(), []),
  };
}
