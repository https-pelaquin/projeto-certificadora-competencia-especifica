import { z } from "zod";

export const yearParam = z.coerce.number().int().min(2000).max(2100);
