import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function create(db: Db, data: Prisma.AuditLogUncheckedCreateInput) {
    return db.auditLog.create({ data });
}
