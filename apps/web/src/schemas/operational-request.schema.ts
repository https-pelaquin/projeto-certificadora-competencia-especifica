import { z } from 'zod';

export const requestComplementSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, 'Informe o complemento solicitado.')
    .max(1000, 'A mensagem deve ter no máximo 1000 caracteres.'),
});

export const createRequestCancellationSchema = (justificationRequired: boolean) =>
  z.object({
    justification: z
      .string()
      .trim()
      .max(500, 'A justificativa deve ter no máximo 500 caracteres.')
      .refine(
        (value) => !justificationRequired || value.length >= 3,
        'Informe a justificativa para cancelar uma solicitação de outro usuário.',
      ),
  });

export type RequestComplementFormValues = z.infer<typeof requestComplementSchema>;
export type RequestCancellationFormValues = z.infer<
  ReturnType<typeof createRequestCancellationSchema>
>;
