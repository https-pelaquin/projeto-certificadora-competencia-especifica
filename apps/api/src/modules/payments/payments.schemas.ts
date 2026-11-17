import { z } from "zod";
import { positiveMoney } from "../../shared/schemas";

// A justificativa é obrigatória quando o valor pago difere do provisionado; quem confere é o service.
export const recordBody = z.object({
    paidAmount: positiveMoney,
    justification: z.string().trim().max(500).optional(),
});
