import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { addMonths } from "../../../shared/dates";
import { createUser, loginAs } from "../../../test/factories";
import { assignRole } from "../users.service";

const app = createApp();

beforeEach(resetDatabase);

async function headAgent() {
    const head = await createUser({ roles: ["HEAD"] });
    return { head, agent: await loginAs(app, head) };
}

describe("permissões", () => {
    it("professor e conselheiro recebem 403 em /api/users", async () => {
        for (const roles of [["PROFESSOR"], ["COUNCIL_MEMBER"], ["FINANCIAL_ADMIN"]] as const) {
            const agent = await loginAs(app, await createUser({ roles: [...roles] }));
            expect((await agent.get("/api/users")).status).toBe(403);
        }
    });

    it("sem sessão responde 401", async () => {
        expect((await request(app).get("/api/users")).status).toBe(401);
    });
});

describe("convite", () => {
    it("cria usuário sem senha, perfis, token e e-mail; convite aceito permite login", async () => {
        const { agent } = await headAgent();

        const res = await agent.post("/api/users").send({ name: "Bia", email: "BIA@dacom.test", roles: ["PROFESSOR", "COUNCIL_MEMBER"] });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ email: "bia@dacom.test", invitePending: true });
        expect(res.body.roles.sort()).toEqual(["COUNCIL_MEMBER", "PROFESSOR"]);
        expect(res.body).not.toHaveProperty("passwordHash");

        const email = await prisma.emailOutbox.findFirstOrThrow({ where: { template: "INVITE" } });
        const token = new URL((email.data as { link: string }).link).searchParams.get("token")!;
        expect((await request(app).post("/api/auth/password/reset").send({ token, password: "senha-da-bia" })).status).toBe(204);
        await loginAs(app, { email: "bia@dacom.test" }, "senha-da-bia");

        const actions = (await prisma.auditLog.findMany({ orderBy: { id: "asc" } })).map((a) => a.action);
        expect(actions).toEqual(expect.arrayContaining(["USER_INVITED", "INVITE_ACCEPTED"]));
    });

    it("e-mail repetido responde 409", async () => {
        const { agent } = await headAgent();
        await agent.post("/api/users").send({ name: "Bia", email: "bia@dacom.test", roles: ["PROFESSOR"] });
        const res = await agent.post("/api/users").send({ name: "Outra", email: "Bia@dacom.test", roles: ["PROFESSOR"] });
        expect(res.status).toBe(409);
    });

    it("reenvio só para convite pendente", async () => {
        const { head, agent } = await headAgent();
        const pending = await createUser({ password: null });
        expect((await agent.post(`/api/users/${pending.id}/invite`).send({})).status).toBe(204);
        expect((await agent.post(`/api/users/${head.id}/invite`).send({})).status).toBe(409);
    });
});

describe("atualização", () => {
    it("desativar revoga a sessão do usuário e é auditado", async () => {
        const { agent } = await headAgent();
        const prof = await createUser();
        const profAgent = await loginAs(app, prof);

        const res = await agent.patch(`/api/users/${prof.id}`).send({ active: false });
        expect(res.status).toBe(200);
        expect(res.body.active).toBe(false);
        expect((await profAgent.get("/api/auth/me")).status).toBe(401);

        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "USER_UPDATED" } });
        expect(log.before).toMatchObject({ active: true });
        expect(log.before).not.toHaveProperty("passwordHash");
    });

    it("chefe não desativa a própria conta", async () => {
        const { head, agent } = await headAgent();
        expect((await agent.patch(`/api/users/${head.id}`).send({ active: false })).status).toBe(422);
    });

    it("usuário inexistente responde 404", async () => {
        const { agent } = await headAgent();
        expect((await agent.patch("/api/users/9999").send({ name: "X" })).status).toBe(404);
    });
});

describe("perfis com vigência", () => {
    it("novo chefe não pode sobrepor o atual e ganha mandato de 2 anos", async () => {
        const { head, agent } = await headAgent();
        const prof = await createUser();

        expect((await agent.post(`/api/users/${prof.id}/roles`).send({ role: "HEAD" })).status).toBe(409);

        const headAssignment = await prisma.roleAssignment.findFirstOrThrow({ where: { userId: head.id, role: "HEAD" } });
        expect((await agent.post(`/api/users/${head.id}/roles/${headAssignment.id}/end`).send({})).status).toBe(200);
        // O antigo chefe perde as permissões na hora.
        expect((await agent.get("/api/users")).status).toBe(403);

        const user = await assignRole({ type: "SYSTEM", job: "test" }, prof.id, { role: "HEAD" });
        const term = user.roleAssignments.find((a) => a.role === "HEAD")!;
        expect(term.endsAt!.getTime()).toBe(addMonths(term.startsAt, 24).getTime());
    });

    it("atribui e encerra conselheiro; histórico preservado", async () => {
        const { agent } = await headAgent();
        const prof = await createUser();

        const assigned = await agent.post(`/api/users/${prof.id}/roles`).send({ role: "COUNCIL_MEMBER" });
        expect(assigned.status).toBe(201);
        expect(assigned.body.roles.sort()).toEqual(["COUNCIL_MEMBER", "PROFESSOR"]);

        const council = assigned.body.roleAssignments.find((a: { role: string }) => a.role === "COUNCIL_MEMBER");
        const ended = await agent.post(`/api/users/${prof.id}/roles/${council.id}/end`).send({});
        expect(ended.body.roles).toEqual(["PROFESSOR"]);
        expect(ended.body.roleAssignments).toHaveLength(2);

        expect((await agent.post(`/api/users/${prof.id}/roles/${council.id}/end`).send({})).status).toBe(409);
        expect((await agent.post(`/api/users/${prof.id}/roles`).send({ role: "PROFESSOR" })).status).toBe(409);
    });

    it("o banco impede dois chefes sobrepostos mesmo sem passar pelo service", async () => {
        await createUser({ roles: ["HEAD"] });
        const other = await createUser();
        await expect(prisma.roleAssignment.create({ data: { userId: other.id, role: "HEAD", startsAt: new Date() } }))
            .rejects.toThrow(/RoleAssignment_single_head/);
    });

    it("fim antes do início responde 422", async () => {
        const { agent } = await headAgent();
        const prof = await createUser();
        const res = await agent.post(`/api/users/${prof.id}/roles`).send({
            role: "COUNCIL_MEMBER",
            startsAt: "2030-01-01T00:00:00Z",
            endsAt: "2029-01-01T00:00:00Z",
        });
        expect(res.status).toBe(422);
    });
});
