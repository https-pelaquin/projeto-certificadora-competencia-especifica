import { z } from "zod";
import { isoDateTime, pagination, positiveMoney } from "../../shared/schemas";

const description = z.string().trim().min(1, "Informe a descrição").max(2000);
const id = z.number().int().positive();

export const status = z.enum([
    "AWAITING_VOTING",
    "AWAITING_COMPLEMENT",
    "AWAITING_BALANCE",
    "IN_VOTING",
    "PROVISIONED",
    "PAID",
    "REJECTED",
    "CANCELED",
]);

// O orçamento é sempre o do ano corrente: quem pede não escolhe.
export const createBody = z.object({
    categoryId: id,
    description,
    amount: positiveMoney,
});

export const editBody = z.object({
    description: description.optional(),
    categoryId: id.optional(),
    amount: positiveMoney.optional(),
}).refine((b) => b.description !== undefined || b.categoryId !== undefined || b.amount !== undefined, "Nada para alterar");

export const cancelBody = z.object({
    justification: z.string().trim().max(500).optional(),
});

export const complementBody = z.object({
    message: z.string().trim().min(1, "Informe o que precisa ser complementado").max(2000),
});

export const listQuery = pagination.extend({
    status: status.optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    requesterId: z.coerce.number().int().positive().optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
});
