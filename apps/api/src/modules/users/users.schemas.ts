import { z } from "zod";
import { email } from "../auth/auth.schemas";
import { isoDateTime } from "../../shared/schemas";

export const role = z.enum(["PROFESSOR", "HEAD", "COUNCIL_MEMBER", "FINANCIAL_ADMIN"]);

const name = z.string().trim().min(1, "Informe o nome").max(120);

export const inviteBody = z.object({
    name,
    email,
    roles: z.array(role).min(1, "Informe ao menos um perfil").refine((r) => new Set(r).size === r.length, "Perfis repetidos"),
});

export const updateBody = z.object({
    name: name.optional(),
    active: z.boolean().optional(),
}).refine((b) => b.name !== undefined || b.active !== undefined, "Nada para alterar");

export const assignRoleBody = z.object({
    role,
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
});

export const endRoleBody = z.object({
    endsAt: isoDateTime.optional(),
});
