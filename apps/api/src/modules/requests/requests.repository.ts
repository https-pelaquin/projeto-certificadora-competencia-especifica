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
