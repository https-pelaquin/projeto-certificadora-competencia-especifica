import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client";
import { env } from "../config/env";

export const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

export type Db = Prisma.TransactionClient;

// Transação só de leitura que enxerga uma "foto" do banco: todas as consultas dela veem o mesmo instante.
// Para relatórios e painéis, em que várias consultas precisam bater entre si.
export const SNAPSHOT = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead } as const;
