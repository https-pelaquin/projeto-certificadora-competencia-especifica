import { z } from 'zod';
import { isAmountLocked } from '@/features/requests/utils/request-state-machine';
import type { ExpenseCategory, RequestStatus } from '@/types';

const EXPENSE_CATEGORIES = [
  'MATERIAL_CONSUMO',
  'SERVICOS_TERCEIROS',
  'EQUIPAMENTOS',
  'DIARIAS_PASSAGENS',
  'OUTROS',
] as const satisfies readonly ExpenseCategory[];

const REQUEST_STATUSES = [
  'DRAFT',
  'AWAITING_VOTING',
  'IN_VOTING',
  'AWAITING_COMPLEMENT',
  'AWAITING_BALANCE',
  'PROVISIONED',
  'PAID',
  'REJECTED',
  'CANCELED',
] as const satisfies readonly RequestStatus[];

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES, {
  message: 'Selecione a categoria da despesa',
});

export const requestStatusSchema = z.enum(REQUEST_STATUSES);

/**
 * Schema compartilhado para validação monetária em reais (R$).
 * Garante valor estritamente positivo (> 0) para respeitar a constraint do banco de dados.
 */
export const requestAmountSchema = z
  .number({ message: 'O valor deve ser maior que zero' })
  .refine((val) => Number.isFinite(val), {
    message: 'Informe um valor numérico válido',
  })
  .min(0.01, 'O valor deve ser maior que zero');

export const requestDescriptionSchema = z
  .string()
  .trim()
  .min(10, 'A justificativa/descrição deve conter pelo menos 10 caracteres')
  .max(500, 'A justificativa não pode ultrapassar 500 caracteres');

/**
 * Schema do modal "Novo Pedido".
 * Exige categoria, justificativa e valor em reais >= R$ 0,01.
 */
export const createRequestSchema = z.object({
  category: expenseCategorySchema,
  amount: requestAmountSchema,
  description: requestDescriptionSchema,
});

export type CreateRequestFormValues = z.infer<typeof createRequestSchema>;

const editableRequestBaseSchema = createRequestSchema.omit({ category: true });
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
  amount?: number;
};

