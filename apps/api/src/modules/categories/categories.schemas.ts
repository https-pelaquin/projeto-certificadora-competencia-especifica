import { z } from "zod";

const name = z.string().trim().min(1, "Informe o nome da categoria").max(80);

export const createBody = z.object({ name });

export const updateBody = z.object({
    name: name.optional(),
    active: z.boolean().optional(),
}).refine((b) => b.name !== undefined || b.active !== undefined, "Nada para alterar");
