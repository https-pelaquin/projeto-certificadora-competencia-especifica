import { z } from "zod";
import { isoDateTime } from "../../shared/schemas";

export const listQuery = z.object({
    actorId: z.coerce.number().int().positive().optional(),
    action: z.string().max(100).optional(),
    entityType: z.string().max(100).optional(),
    entityId: z.string().max(100).optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
