import { z } from 'zod';

export const votingStatusSchema = z.enum([
  'OPEN',
  'AWAITING_TIE_BREAK',
  'CLOSED',
  'CANCELED',
]);

export const voteSchema = z.object({
  choice: z.enum(['APPROVE', 'REJECT', 'ABSTAIN']),
});

export const tieBreakSchema = z.object({
  choice: z.enum(['APPROVE', 'REJECT']),
});

export const openVotingSchema = z.object({
  deadline: z
    .string()
    .min(1, 'Informe o prazo da votação')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Informe uma data válida')
    .refine((value) => new Date(value).getTime() > Date.now(), 'O prazo deve estar no futuro'),
});

export const votingCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Escreva o comentário')
    .max(2000, 'O comentário não pode ultrapassar 2.000 caracteres'),
});

export type OpenVotingFormValues = z.infer<typeof openVotingSchema>;
export type VotingCommentFormValues = z.infer<typeof votingCommentSchema>;
