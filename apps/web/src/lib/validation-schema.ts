import { z } from 'zod';
import { isAcreMunicipalityOption, normalizeMunicipality } from '@/lib/acre-municipalities';
import { getValidationDraft } from '@/lib/validation-draft-cache';
import type { ValidationItem } from '@/types/domain';

export const validationFormSchema = z.object({
  executionStatus: z.string().min(1, 'Informe o status da execução.'),
  realizedDescription: z.string().optional(),
  informedExecutedValue: z.coerce.number().min(0, 'Informe um valor válido.'),
  observations: z.string().optional(),
  deliveries: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Informe o nome da entrega.'),
        description: z.string().min(3, 'Descrição deve ter pelo menos 3 caracteres.'),
        quantity: z.coerce.number().min(0, 'Informe uma quantidade válida.'),
        municipality: z
          .string()
          .min(1, 'Selecione o município.')
          .refine(isAcreMunicipalityOption, 'Selecione o município.'),
        beneficiaries: z.string().min(1, 'Informe o público beneficiado.'),
      }),
    )
    .min(1, 'Cadastre ao menos uma entrega.'),
});

export type ValidationFormInput = z.input<typeof validationFormSchema>;
export type ValidationFormValues = z.output<typeof validationFormSchema>;

export function blankDelivery(sequence = 1) {
  return {
    name: `Entrega ${sequence}`,
    description: '',
    quantity: 0,
    municipality: '',
    beneficiaries: '',
  };
}

export function normalizeDeliveries(
  deliveries: Array<{ name?: string; id?: string; description: string; quantity: number; municipality: string; beneficiaries: string }>,
) {
  return deliveries.length
    ? deliveries.map((delivery, index) => ({
        ...delivery,
        name: delivery.name?.trim() || `Entrega ${index + 1}`,
        municipality: normalizeMunicipality(delivery.municipality),
      }))
    : [blankDelivery()];
}

export function emptyValidationFormValues(): ValidationFormInput {
  return {
    executionStatus: 'EM_EXECUCAO',
    realizedDescription: '',
    informedExecutedValue: 0,
    observations: '',
    deliveries: [blankDelivery(1)],
  };
}

const ROOT_FIELD_LABELS: Record<string, string> = {
  executionStatus: 'Status da execução',
  realizedDescription: 'Descrição do realizado',
  informedExecutedValue: 'Valor executado informado',
  observations: 'Observações',
  deliveries: 'Entregas realizadas',
};

const DELIVERY_FIELD_LABELS: Record<string, string> = {
  name: 'Nome da entrega',
  description: 'Descrição',
  quantity: 'Quantidade',
  municipality: 'Município',
  beneficiaries: 'Público beneficiado',
};

function formatValidationIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) return 'Formulário';

  const root = String(path[0]);
  if (root === 'deliveries') {
    if (path.length === 1) return ROOT_FIELD_LABELS.deliveries;
    const deliveryIndex = typeof path[1] === 'number' ? path[1] + 1 : 1;
    const field = path[2];
    if (typeof field === 'string' && DELIVERY_FIELD_LABELS[field]) {
      return `Entrega ${deliveryIndex} — ${DELIVERY_FIELD_LABELS[field]}`;
    }
    return `Entrega ${deliveryIndex}`;
  }

  return ROOT_FIELD_LABELS[root] ?? root;
}

export function toValidationFormInput(validation: ValidationItem): ValidationFormInput {
  return {
    executionStatus: validation.executionStatus ?? 'EM_EXECUCAO',
    realizedDescription: validation.realizedDescription ?? '',
    informedExecutedValue: validation.informedExecutedValue ?? 0,
    observations: validation.observations ?? '',
    deliveries: normalizeDeliveries(validation.deliveries),
  };
}

export function getValidationFormIssues(values: ValidationFormInput): string[] {
  const result = validationFormSchema.safeParse(values);
  if (result.success) return [];

  const seen = new Set<string>();
  const issues: string[] = [];
  for (const issue of result.error.issues) {
    const label = formatValidationIssuePath(issue.path);
    const text = label ? `${label}: ${issue.message}` : issue.message;
    if (!seen.has(text)) {
      seen.add(text);
      issues.push(text);
    }
  }
  return issues;
}

export type ValidationSubmitIssue = {
  validationId: string;
  title: string;
  items: string[];
  isSelected: boolean;
};

export function collectPendingValidationIssues(
  pending: ValidationItem[],
  currentId: string | undefined,
  currentFormValues: ValidationFormInput | null,
): ValidationSubmitIssue[] {
  return pending
    .map((validation) => {
      const values =
        validation.id === currentId && currentFormValues
          ? currentFormValues
          : getValidationDraft(validation.id) ?? toValidationFormInput(validation);
      const items = getValidationFormIssues(values);
      if (!items.length) return null;
      return {
        validationId: validation.id,
        title: validation.action?.application ?? 'Validação',
        items,
        isSelected: validation.id === currentId,
      };
    })
    .filter((issue): issue is ValidationSubmitIssue => issue !== null)
    .sort((a, b) => Number(b.isSelected) - Number(a.isSelected));
}
