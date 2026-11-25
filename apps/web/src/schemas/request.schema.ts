import { z } from 'zod';
import { isAmountLocked } from '@/features/requests/utils/request-state-machine';
import type { RequestStatus } from '@/types';

const REQUEST_STATUSES = [
  'AWAITING_VOTING',
  'IN_VOTING',
  'AWAITING_COMPLEMENT',
  'AWAITING_BALANCE',
  'PROVISIONED',
  'PAID',
  'REJECTED',
  'CANCELED',
] as const satisfies readonly RequestStatus[];

const moneyPattern = /^(?:\d{1,12}(?:\.\d{3})*,\d{2}|\d{1,12}(?:\.\d{1,2})?)$/;

function parseMoneyString(value: string): number {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  return Number(normalized);
}

export const requestCategoryIdSchema = z
  .number({ message: 'Selecione a categoria da despesa' })
  .int('Selecione uma categoria válida')
  .positive('Selecione a categoria da despesa');

export const requestStatusSchema = z.enum(REQUEST_STATUSES);

/**
 * Schema compartilhado para validação monetária em reais (R$).
 * Aceita string mascarada ("1.500,00") ou decimal ("1500.00") estritamente positiva (> 0).
 */
export const requestAmountSchema = z
  .string({ message: 'O valor deve ser maior que zero' })
  .trim()
  .min(1, 'O valor deve ser maior que zero')
  .regex(moneyPattern, 'Informe um valor monetário válido')
  .refine((val) => Number.isFinite(parseMoneyString(val)) && parseMoneyString(val) > 0, {
    message: 'O valor deve ser maior que zero',
  });

export const requestDescriptionSchema = z
  .string()
  .trim()
  .min(10, 'A justificativa/descrição deve conter pelo menos 10 caracteres')
  .max(2000, 'A justificativa não pode ultrapassar 2000 caracteres');

/**
 * Schema do modal "Novo Pedido".
 * Exige categoryId, justificativa e valor em reais >= R$ 0,01.
 */
export const createRequestSchema = z.object({
  categoryId: requestCategoryIdSchema,
  amount: requestAmountSchema,
  description: requestDescriptionSchema,
});

export type CreateRequestFormValues = z.infer<typeof createRequestSchema>;

const editableRequestBaseSchema = createRequestSchema.omit({ categoryId: true });
const lockedUpdateRequestSchema = editableRequestBaseSchema.omit({ amount: true });

/**
 * Retorna o schema Zod de atualização condicionado ao status atual do pedido.
 * Se o pedido já foi aprovado (`PROVISIONED` ou `PAID`), o campo `amount` é omitido.
 */
export function createUpdateRequestSchema(status: RequestStatus) {
  return isAmountLocked(status)
    ? lockedUpdateRequestSchema
    : editableRequestBaseSchema;
}

/**
 * Schema Zod para validação de atualização com omissão condicional do campo `amount`
 * quando o status do pedido já está travado após aprovação (`PROVISIONED` ou `PAID`).
 */
export const updateRequestSchema = z
  .object({
    status: requestStatusSchema,
    description: requestDescriptionSchema,
    amount: requestAmountSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!isAmountLocked(data.status) && data.amount === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'O valor deve ser maior que zero',
      });
    }
  })
  .transform(({ status, description, amount }) =>
    isAmountLocked(status) ? { description } : { description, amount },
  );

export type UpdateRequestFormValues = {
  description: string;
  amount?: string;
};

