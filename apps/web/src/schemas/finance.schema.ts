import { z } from 'zod';

const moneyPattern = /^(?:\d{1,12}(?:\.\d{3})*,\d{2}|\d{1,12}(?:\.\d{1,2})?)$/;

function moneyValue(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  return Number(normalized);
}

export function moneyToApi(value: string): string {
  return moneyValue(value).toFixed(2);
}

const moneyString = z
  .string()
  .trim()
  .min(1, 'Informe o valor')
  .regex(moneyPattern, 'Informe um valor monetário válido');

const nonNegativeMoney = moneyString.refine(
  (value) => moneyValue(value) >= 0,
  'O valor não pode ser negativo',
);

const positiveMoney = moneyString.refine(
  (value) => moneyValue(value) > 0,
  'O valor deve ser maior que zero',
);

export const budgetSchema = z.object({
  year: z
    .number({ message: 'Informe o ano' })
    .int('Informe um ano válido')
    .min(2000, 'O ano mínimo é 2000')
    .max(2100, 'O ano máximo é 2100'),
  initialAmount: nonNegativeMoney,
});

export const budgetAdjustmentSchema = z.object({
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  amount: positiveMoney,
  justification: z
    .string()
    .trim()
    .min(1, 'Informe a justificativa')
    .max(500, 'A justificativa deve ter no máximo 500 caracteres'),
});

export const approvalLimitSchema = z.object({
  amount: positiveMoney,
  periodMonths: z
    .number({ message: 'Informe o período' })
    .int('O período deve ser inteiro')
    .min(1, 'O período mínimo é 1 mês')
    .max(120, 'O período máximo é 120 meses'),
  validFrom: z.string().optional(),
});

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da categoria')
    .max(80, 'O nome deve ter no máximo 80 caracteres'),
});

export function createPaymentSchema(provisionedAmount: string) {
  return z
    .object({
      paidAmount: positiveMoney,
      justification: z
        .string()
        .trim()
        .max(500, 'A justificativa deve ter no máximo 500 caracteres'),
    })
    .superRefine((value, context) => {
      if (
        moneyToApi(value.paidAmount) !== moneyToApi(provisionedAmount) &&
        !value.justification
      ) {
        context.addIssue({
          code: 'custom',
          path: ['justification'],
          message: 'Justifique a diferença em relação ao valor provisionado',
        });
      }
    });
}

export type BudgetFormValues = z.infer<typeof budgetSchema>;
export type BudgetAdjustmentFormValues = z.infer<typeof budgetAdjustmentSchema>;
export type ApprovalLimitFormValues = z.infer<typeof approvalLimitSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type PaymentFormValues = z.infer<ReturnType<typeof createPaymentSchema>>;
