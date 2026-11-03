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

export function list(db: Db) {
    return db.approvalLimit.findMany({ orderBy: { validFrom: "desc" } });
}

// O limite de início mais recente, vigente ou agendado. É contra ele que um novo cadastro é comparado.
export function findLatest(db: Db) {
    return db.approvalLimit.findFirst({ orderBy: { validFrom: "desc" } });
}

// Serializa os cadastros de limite: dois ao mesmo tempo nunca leem o mesmo "último" limite.
// O lock é solto sozinho no fim da transação.
export async function lockWrites(db: Db) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ApprovalLimit'))`;
}

export function end(db: Db, id: number, validUntil: Date) {
    return db.approvalLimit.update({ where: { id }, data: { validUntil } });
}
