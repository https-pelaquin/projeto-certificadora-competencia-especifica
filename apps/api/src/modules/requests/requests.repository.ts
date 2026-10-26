import { Prisma, RequestStatus } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

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
