import { z } from "zod";
import { isoDateTime, money, pagination, positiveMoney } from "../../shared/schemas";

export const createBody = z.object({
    year: z.number().int().min(2000).max(2100),
    initialAmount: money,
});

export const adjustBody = z.object({
    type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
    amount: positiveMoney,
    justification: z.string().trim().min(1, "Informe a justificativa").max(500),
});

export const ledgerQuery = pagination;

export const createLimitBody = z.object({
    amount: positiveMoney,
    periodMonths: z.number().int().min(1).max(120),
    // Sem data, o limite vale a partir de agora.
    validFrom: isoDateTime.optional(),
});
