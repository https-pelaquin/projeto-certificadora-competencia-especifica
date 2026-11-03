import { LedgerEntryType, Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: { year: number; initialAmount: Prisma.Decimal; createdById: number | null }) {
    return db.budget.create({ data });
}

export function findById(db: Db, id: number) {
    return db.budget.findUnique({ where: { id } });
}

export function findByYear(db: Db, year: number) {
    return db.budget.findUnique({ where: { year } });
}

export function list(db: Db) {
    return db.budget.findMany({ orderBy: { year: "desc" } });
}

export function listLedger(db: Db, budgetId: number, page: { skip: number; take: number }) {
    return db.ledgerEntry.findMany({
        where: { budgetId },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
        ...page,
    });
}

export function countLedger(db: Db, budgetId: number) {
    return db.ledgerEntry.count({ where: { budgetId } });
}

// SELECT FOR UPDATE na linha do orçamento serializa todas as operações que leem saldo e gravam no ledger.
export async function lock(db: Db, id: number) {
    const rows = await db.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Budget" WHERE id = ${id} FOR UPDATE
    `;
    return rows.length > 0;
}

export function createLedgerEntry(db: Db, data: {
    budgetId: number;
    requestId?: number | null;
    type: LedgerEntryType;
    amount: Prisma.Decimal;
    justification?: string | null;
    createdById: number | null;
}) {
    return db.ledgerEntry.create({ data });
}

export function sumLedgerByTypeForRequest(db: Db, requestId: number) {
    return db.ledgerEntry.groupBy({
        by: ["type"],
        where: { requestId },
        _sum: { amount: true },
    });
}

export function sumLedgerByType(db: Db, budgetId: number) {
    return db.ledgerEntry.groupBy({
        by: ["type"],
        where: { budgetId },
        _sum: { amount: true },
    });
}
