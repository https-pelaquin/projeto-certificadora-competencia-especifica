import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: {
    requestId: number;
    recordedById: number;
    paidAmount: Prisma.Decimal;
    justification?: string;
}) {
    return db.payment.create({ data });
}
