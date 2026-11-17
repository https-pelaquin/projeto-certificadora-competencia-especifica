import { Prisma, RequestStatus } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: {
    requesterId: number;
    categoryId: number;
    budgetId: number;
    approvalLimitId: number;
    description: string;
    amount: Prisma.Decimal;
    status: RequestStatus;
}) {
    return db.request.create({ data });
}

export async function sumByRequester(db: Db, data: {
    requesterId: number;
    statuses: RequestStatus[];
    since: Date;
    excludeRequestId?: number;
}) {
    const result = await db.request.aggregate({
        _sum: { amount: true },
        where: {
            requesterId: data.requesterId,
            status: { in: data.statuses },
            createdAt: { gte: data.since },
            ...(data.excludeRequestId !== undefined && { id: { not: data.excludeRequestId } }),
        },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
}

// Ordem de locks do sistema: Request → Voting → Budget (evita deadlock entre votação e cancelamento).
export async function lock(db: Db, id: number) {
    const rows = await db.$queryRaw<{ id: number }[]>`SELECT id FROM "Request" WHERE id = ${id} FOR UPDATE`;
    return rows.length > 0;
}

export function findById(db: Db, id: number) {
    return db.request.findUnique({ where: { id } });
}

export function updateStatus(db: Db, id: number, status: RequestStatus) {
    return db.request.update({ where: { id }, data: { status } });
}

export function update(db: Db, id: number, data: {
    description?: string;
    categoryId?: number;
    amount?: Prisma.Decimal;
    approvalLimitId?: number;
}) {
    return db.request.update({ where: { id }, data });
}

export function createComplement(db: Db, data: { requestId: number; requestedById: number; message: string }) {
    return db.complementRequest.create({ data });
}

const summary = {
    requester: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
} as const;

export function list(db: Db, where: Prisma.RequestWhereInput, page: { skip: number; take: number }) {
    return db.request.findMany({ where, include: summary, orderBy: { id: "desc" }, ...page });
}

export function count(db: Db, where: Prisma.RequestWhereInput) {
    return db.request.count({ where });
}

export function findDetailed(db: Db, id: number) {
    return db.request.findUnique({
        where: { id },
        include: {
            ...summary,
            budget: { select: { id: true, year: true } },
            approvalLimit: { select: { id: true, amount: true, periodMonths: true } },
            payment: true,
            complementRequests: {
                include: { requestedBy: { select: { id: true, name: true } } },
                orderBy: { id: "asc" },
            },
        },
    });
}
