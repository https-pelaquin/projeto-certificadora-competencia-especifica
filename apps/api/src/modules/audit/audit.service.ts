import { Prisma } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { prisma, type Db } from "../../shared/prisma";
import * as auditRepository from "./audit.repository";
import type { AuditFilters } from "./audit.repository";

export type AuditEntry = {
    action: string;
    entityType: string;
    entityId: number | string;
    before?: unknown;
    after?: unknown;
    justification?: string | null;
};

// Nunca gravar segredos no histórico, mesmo que o chamador passe o registro inteiro.
const SECRET_KEYS = new Set(["passwordHash", "password", "tokenHash", "token"]);

function snapshot(value: unknown) {
    if (value === undefined || value === null) {
        return undefined;
    }
    // Decimal e Date viram string pelo próprio toJSON.
    return JSON.parse(JSON.stringify(value, (key, v) => (SECRET_KEYS.has(key) ? undefined : v))) as Prisma.InputJsonValue;
}

// Sempre chamado com o mesmo `db` (tx) da alteração auditada: se a ação falhar, a auditoria também é desfeita.
export function record(db: Db, actor: Actor, entry: AuditEntry) {
    return auditRepository.create(db, {
        actorType: actor.type,
        actorId: actor.type === "USER" ? actor.userId : null,
        job: actor.type === "SYSTEM" ? actor.job : null,
        ip: actor.type === "USER" ? actor.ip : null,
        requestId: actor.type === "USER" ? actor.requestId : null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: String(entry.entityId),
        before: snapshot(entry.before),
        after: snapshot(entry.after),
        justification: entry.justification ?? null,
    });
}

export async function listAuditLogs(filters: AuditFilters, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
        auditRepository.list(prisma, filters, { skip: (page - 1) * pageSize, take: pageSize }),
        auditRepository.count(prisma, filters),
    ]);
    return { items, page, pageSize, total };
}
