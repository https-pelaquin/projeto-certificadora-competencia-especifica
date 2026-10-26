import { z } from "zod";

export const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido"));

export const password = z.string()
    .min(8, "A senha deve ter pelo menos 8 caracteres")
    .max(72, "A senha deve ter no máximo 72 caracteres");

export const loginBody = z.object({
    email,
    password: z.string().min(1).max(72),
});

export const forgotPasswordBody = z.object({
    email,
});

export const resetPasswordBody = z.object({
    token: z.string().min(1).max(200),
    password,
});

export const meResponse = z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.email(),
    roles: z.array(z.enum(["PROFESSOR", "HEAD", "COUNCIL_MEMBER", "FINANCIAL_ADMIN"])),
    permissions: z.array(z.string()),
});
