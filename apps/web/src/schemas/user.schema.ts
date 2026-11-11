import { z } from 'zod';
import type { Role } from '@/types';

const ROLES = [
  'PROFESSOR',
  'COUNCIL_MEMBER',
  'HEAD',
  'FINANCIAL_ADMIN',
] as const satisfies readonly Role[];

export const roleSchema = z.enum(ROLES, {
  message: 'Selecione um perfil de acesso válido',
});

const tenureFields = {
  role: roleSchema,
  startsAt: z.string().min(1, 'Informe a data de início da vigência'),
  endsAt: z.string().optional(),
};

function validateTenureRules(
  data: { role: Role; startsAt: string; endsAt?: string },
  ctx: z.RefinementCtx,
  hasActiveHead: boolean,
) {
  if (hasActiveHead && data.role === 'HEAD') {
    ctx.addIssue({
      code: 'custom',
      path: ['role'],
      message:
        'Já existe outro Chefe de Departamento com mandato vigente ativo.',
    });
  }

  if (data.endsAt && data.startsAt) {
    const startMs = Date.parse(data.startsAt);
    const endMs = Date.parse(data.endsAt);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'A data de término não pode ser anterior ao início.',
      });
    }
  }
}

export function createInviteUserSchema(hasActiveHead: boolean) {
  return z
    .object({
      name: z.string().trim().min(3, 'Informe o nome completo do usuário'),
      email: z
        .string()
        .trim()
        .email('E-mail institucional inválido')
        .refine((val) => val.toLowerCase().endsWith('@utfpr.edu.br'), {
          message: 'Utilize o e-mail institucional (@utfpr.edu.br)',
        }),
      ...tenureFields,
    })
    .superRefine((data, ctx) => validateTenureRules(data, ctx, hasActiveHead));
}

export function createAssignProfileSchema(hasActiveHead: boolean) {
  return z
    .object({
      ...tenureFields,
    })
    .superRefine((data, ctx) => validateTenureRules(data, ctx, hasActiveHead));
}

export type InviteUserFormData = z.infer<
  ReturnType<typeof createInviteUserSchema>
>;
export type AssignProfileFormData = z.infer<
  ReturnType<typeof createAssignProfileSchema>
>;

