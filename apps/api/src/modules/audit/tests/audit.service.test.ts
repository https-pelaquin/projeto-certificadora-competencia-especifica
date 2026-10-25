import { beforeEach, expect, it } from "vitest";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { record } from "../audit.service";

const system = { type: "SYSTEM", job: "test" } as const;

beforeEach(resetDatabase);

it("grava ator, entidade e valores sem campos secretos", async () => {
    const user = await prisma.user.create({ data: { name: "Ana", email: "ana@x.com", passwordHash: "hash" } });
    const log = await record(prisma, { type: "USER", userId: user.id, ip: "127.0.0.1", requestId: "r1" }, {
        action: "USER_UPDATED",
        entityType: "User",
        entityId: user.id,
        before: user,
        after: { ...user, name: "Ana B." },
    });

    expect(log.actorId).toBe(user.id);
    expect(log.entityId).toBe(String(user.id));
    expect(log.before).not.toHaveProperty("passwordHash");
    expect(log.after).toMatchObject({ name: "Ana B." });
});

it("falha na transação desfaz a auditoria junto", async () => {
    await expect(prisma.$transaction(async (tx) => {
        await record(tx, system, { action: "X", entityType: "Test", entityId: 1 });
        throw new Error("falha forçada");
    })).rejects.toThrow("falha forçada");

    expect(await prisma.auditLog.count()).toBe(0);
});

it("o banco recusa UPDATE e DELETE na auditoria", async () => {
    await record(prisma, system, { action: "X", entityType: "Test", entityId: 1 });
    await expect(prisma.auditLog.updateMany({ data: { action: "Y" } })).rejects.toThrow(/só de inclusão/);
    await expect(prisma.auditLog.deleteMany()).rejects.toThrow(/só de inclusão/);
});
