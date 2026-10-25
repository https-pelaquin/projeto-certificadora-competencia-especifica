import { prisma } from "../shared/prisma";

// TRUNCATE não dispara os triggers de UPDATE/DELETE, então também limpa ledger e auditoria.
export async function resetDatabase() {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
