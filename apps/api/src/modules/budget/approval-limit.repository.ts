import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: {
    amount: Prisma.Decimal;
    periodMonths: number;
    validFrom: Date;
    createdById: number | null;
}) {
    return db.approvalLimit.create({ data });
}

export function findValidAt(db: Db, date: Date) {
    return db.approvalLimit.findFirst({
        where: {
            validFrom: { lte: date },
            OR: [{ validUntil: null }, { validUntil: { gt: date } }],
        },
        orderBy: { validFrom: "desc" },
    });
}

export function end(db: Db, id: number, validUntil: Date) {
    return db.approvalLimit.update({ where: { id }, data: { validUntil } });
}
