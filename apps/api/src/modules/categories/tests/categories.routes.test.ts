import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { BusinessRuleError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";
import { requireActive } from "../categories.service";

const app = createApp();

beforeEach(resetDatabase);

async function as(role: "HEAD" | "PROFESSOR" | "COUNCIL_MEMBER") {
    const user = await createUser({ roles: [role] });
    return { user, agent: await loginAs(app, user) };
}

describe("administração (só o chefe)", () => {
    it("o chefe cria e a criação é auditada", async () => {
        const { agent, user } = await as("HEAD");

        const res = await agent.post("/api/categories").send({ name: "  Passagens  " });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: "Passagens", active: true });
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "CATEGORY_CREATED" } });
        expect(log.actorId).toBe(user.id);
    });

    it("professor e conselheiro recebem 403 ao criar ou alterar", async () => {
        const head = await as("HEAD");
        const { body } = await head.agent.post("/api/categories").send({ name: "Eventos" });

        for (const role of ["PROFESSOR", "COUNCIL_MEMBER"] as const) {
            const { agent } = await as(role);
            expect((await agent.post("/api/categories").send({ name: "Outra" })).status).toBe(403);
            expect((await agent.patch(`/api/categories/${body.id}`).send({ active: false })).status).toBe(403);
        }
        expect((await request(app).post("/api/categories").send({ name: "x" })).status).toBe(401);
    });

    it("nome repetido dá 409, mesmo ao renomear", async () => {
        const { agent } = await as("HEAD");
        await agent.post("/api/categories").send({ name: "Eventos" });
        const other = await agent.post("/api/categories").send({ name: "Diárias" });

        const created = await agent.post("/api/categories").send({ name: "Eventos" });
        expect(created.status).toBe(409);
        expect(created.body.error.message).toBe("Já existe uma categoria chamada \"Eventos\"");

        const renamed = await agent.patch(`/api/categories/${other.body.id}`).send({ name: "Eventos" });
        expect(renamed.status).toBe(409);
        expect(renamed.body.error.message).toBe("Já existe uma categoria chamada \"Eventos\"");
    });

    it("renomeia, desativa e reativa; mudança é auditada com antes e depois", async () => {
        const { agent } = await as("HEAD");
        const { body } = await agent.post("/api/categories").send({ name: "Eventos" });

        const renamed = await agent.patch(`/api/categories/${body.id}`).send({ name: "Congressos" });
        expect(renamed.body).toMatchObject({ name: "Congressos", active: true });

        const off = await agent.patch(`/api/categories/${body.id}`).send({ active: false });
        expect(off.body.active).toBe(false);
        expect((await agent.patch(`/api/categories/${body.id}`).send({ active: true })).body.active).toBe(true);

        const logs = await prisma.auditLog.findMany({ where: { action: "CATEGORY_UPDATED" }, orderBy: { id: "asc" } });
        expect(logs).toHaveLength(3);
        expect(logs[0].before).toMatchObject({ name: "Eventos" });
        expect(logs[0].after).toMatchObject({ name: "Congressos" });
    });

    it("valida o corpo e a existência", async () => {
        const { agent } = await as("HEAD");
        expect((await agent.post("/api/categories").send({ name: "   " })).status).toBe(400);
        expect((await agent.post("/api/categories").send({})).status).toBe(400);
        expect((await agent.post("/api/categories").send({ name: "x".repeat(81) })).status).toBe(400);
        expect((await agent.patch("/api/categories/999999").send({ active: false })).status).toBe(404);
        expect((await agent.patch("/api/categories/1").send({})).status).toBe(400);
    });
});

describe("listagem", () => {
    it("o chefe vê todas; os demais veem só as ativas, em ordem alfabética", async () => {
        const head = await as("HEAD");
        for (const name of ["Diárias", "Anuidades", "Passagens"]) {
            await head.agent.post("/api/categories").send({ name });
        }
        const passagens = (await prisma.expenseCategory.findFirstOrThrow({ where: { name: "Passagens" } })).id;
        await head.agent.patch(`/api/categories/${passagens}`).send({ active: false });

        expect((await head.agent.get("/api/categories")).body.map((c: { name: string }) => c.name)).toEqual(["Anuidades", "Diárias", "Passagens"]);

        for (const role of ["PROFESSOR", "COUNCIL_MEMBER"] as const) {
            const { agent } = await as(role);
            expect((await agent.get("/api/categories")).body.map((c: { name: string }) => c.name)).toEqual(["Anuidades", "Diárias"]);
        }
        expect((await request(app).get("/api/categories")).status).toBe(401);
    });
});

describe("requireActive (usada ao criar ou editar uma solicitação)", () => {
    it("aceita ativa, recusa inexistente e inativa", async () => {
        const active = await prisma.expenseCategory.create({ data: { name: "Ativa" } });
        const inactive = await prisma.expenseCategory.create({ data: { name: "Inativa", active: false } });

        await expect(requireActive(prisma, active.id)).resolves.toMatchObject({ name: "Ativa" });
        await expect(requireActive(prisma, inactive.id)).rejects.toThrow("Esta categoria está inativa");
        await expect(requireActive(prisma, 999999)).rejects.toThrow(BusinessRuleError);
    });
});
