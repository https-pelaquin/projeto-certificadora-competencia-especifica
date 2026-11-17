import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

// Consultas só de leitura, agregadas por orçamento (ano). Canceladas não entram nos valores e rankings.
const active = { status: { not: "CANCELED" } } as const;

export function countByStatus(db: Db, budgetId: number) {
    return db.request.groupBy({
        by: ["status"],
        where: { budgetId },
        _count: { _all: true },
        _sum: { amount: true },
    });
}

type MonthRow = { month: string; count: number; amount: Prisma.Decimal | string };

// Mês pelo fuso de Brasília, para uma solicitação das 22h do dia 31 não cair no mês seguinte.
export function requestedByMonth(db: Db, budgetId: number) {
    return db.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS month,
               COUNT(*)::int AS count,
               SUM("amount") AS amount
        FROM "Request"
        WHERE "budgetId" = ${budgetId} AND "status" <> 'CANCELED'
        GROUP BY 1
        ORDER BY 1
    `;
}

export function paidByMonth(db: Db, budgetId: number) {
    return db.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', p."paidAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS month,
               COUNT(*)::int AS count,
               SUM(p."paidAmount") AS amount
        FROM "Payment" p
        JOIN "Request" r ON r."id" = p."requestId"
        WHERE r."budgetId" = ${budgetId}
        GROUP BY 1
        ORDER BY 1
    `;
}

export function topRequesters(db: Db, budgetId: number, take: number) {
    return db.request.groupBy({
        by: ["requesterId"],
        where: { budgetId, ...active },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take,
    });
}

export function topCategories(db: Db, budgetId: number, take: number) {
    return db.request.groupBy({
        by: ["categoryId"],
        where: { budgetId, ...active },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take,
    });
}

export function userNames(db: Db, ids: number[]) {
    return db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}

export function categoryNames(db: Db, ids: number[]) {
    return db.expenseCategory.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}
