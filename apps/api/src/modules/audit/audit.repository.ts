import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: Prisma.AuditLogUncheckedCreateInput) {
    return db.auditLog.create({ data });
}

export type AuditFilters = {
    actorId?: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
};

function where(f: AuditFilters): Prisma.AuditLogWhereInput {
    return {
        actorId: f.actorId,
        action: f.action,
        entityType: f.entityType,
        entityId: f.entityId,
        occurredAt: { gte: f.from, lt: f.to },
    };
}

export function list(db: Db, filters: AuditFilters, page: { skip: number; take: number }) {
    return db.auditLog.findMany({
        where: where(filters),
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { id: "desc" },
        ...page,
    });
}

export function count(db: Db, filters: AuditFilters) {
    return db.auditLog.count({ where: where(filters) });
}
