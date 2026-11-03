import { z } from "zod";

export const query = z.object({
    // Sem ano, usa o corrente.
    year: z.coerce.number().int().min(2000).max(2100).optional(),
});
