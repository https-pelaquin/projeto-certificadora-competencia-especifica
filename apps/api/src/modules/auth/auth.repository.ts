import type { PasswordTokenPurpose } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function createToken(db: Db, data: { userId: number; tokenHash: string; purpose: PasswordTokenPurpose; expiresAt: Date }) {
    return db.passwordToken.create({ data });
}

export function findTokenByHash(db: Db, tokenHash: string) {
    return db.passwordToken.findUnique({ where: { tokenHash }, include: { user: true } });
}

export function invalidateOpenTokens(db: Db, userId: number, now: Date) {
    return db.passwordToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
}

export function deleteSessionsOf(db: Db, userId: number) {
    return db.$executeRaw`DELETE FROM "session" WHERE (sess->>'userId')::int = ${userId}`;
}
