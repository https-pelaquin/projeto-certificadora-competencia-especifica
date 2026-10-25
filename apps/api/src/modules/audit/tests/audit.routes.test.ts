import request from "supertest";
import { beforeEach, expect, it } from "vitest";
import { createApp } from "../../../app";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";

const app = createApp();

beforeEach(resetDatabase);

it("chefe e responsável financeiro consultam; professor recebe 403", async () => {
    const head = await createUser({ roles: ["HEAD"] });
    const finance = await createUser({ roles: ["FINANCIAL_ADMIN"] });
    const prof = await createUser();

    expect((await (await loginAs(app, head)).get("/api/audit-logs")).status).toBe(200);
    expect((await (await loginAs(app, finance)).get("/api/audit-logs")).status).toBe(200);
    expect((await (await loginAs(app, prof)).get("/api/audit-logs")).status).toBe(403);
});

it("filtra por ação e ator, pagina e não expõe segredos", async () => {
    const head = await createUser({ roles: ["HEAD"] });
    const agent = await loginAs(app, head);
    await agent.post("/api/users").send({ name: "Bia", email: "bia@dacom.test", roles: ["PROFESSOR"] });

    const res = await agent.get(`/api/audit-logs?action=USER_INVITED&actorId=${head.id}&pageSize=10`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(res.body.items[0]).toMatchObject({ action: "USER_INVITED", entityType: "User", actor: { id: head.id } });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);

    const logins = await agent.get("/api/audit-logs?action=LOGIN");
    expect(logins.body.total).toBe(1);
});

it("filtro inválido responde 400", async () => {
    const agent = await loginAs(app, await createUser({ roles: ["HEAD"] }));
    expect((await agent.get("/api/audit-logs?from=ontem")).status).toBe(400);
    expect((await agent.get("/api/audit-logs?pageSize=1000")).status).toBe(400);
});
