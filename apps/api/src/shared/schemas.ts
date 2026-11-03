import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";

export const idParam = z.coerce.number().int().positive();

export const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

// Dinheiro só entra como texto decimal ("1500.50"). Um número JSON passaria por ponto flutuante antes de virar Decimal.
export const money = z.string().trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use um valor decimal com até 2 casas, como 1500.50")
    .transform((value) => new Prisma.Decimal(value));

export const positiveMoney = money.refine((value) => value.greaterThan(0), "O valor deve ser maior que zero");

export const pagination = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
