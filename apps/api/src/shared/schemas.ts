import { z } from "zod";

export const idParam = z.coerce.number().int().positive();

export const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
