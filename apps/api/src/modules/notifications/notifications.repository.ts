import { Prisma } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

// skipDuplicates = ON CONFLICT ("dedupeKey") DO NOTHING
export function enqueue(db: Db, emails: Prisma.EmailOutboxCreateManyInput[]) {
    return db.emailOutbox.createMany({ data: emails, skipDuplicates: true });
}

// SKIP LOCKED: duas instâncias da rotina nunca pegam o mesmo e-mail.
export async function lockDue(db: Db, now: Date, limit: number) {
    const rows = await db.$queryRaw<{ id: number }[]>`
        SELECT id FROM "EmailOutbox"
        WHERE status = 'PENDING' AND "nextAttemptAt" <= ${now}
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
    `;
    return db.emailOutbox.findMany({ where: { id: { in: rows.map((r) => r.id) } }, orderBy: { id: "asc" } });
}

export function update(db: Db, id: number, data: Prisma.EmailOutboxUpdateInput) {
    return db.emailOutbox.update({ where: { id }, data });
}
