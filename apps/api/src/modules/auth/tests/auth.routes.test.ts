import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs, PASSWORD } from "../../../test/factories";

const app = createApp();

beforeEach(resetDatabase);

describe("login, me e logout", () => {
    it("login válido cria sessão e /me devolve perfis e permissões", async () => {
        const user = await createUser({ roles: ["HEAD", "COUNCIL_MEMBER"], email: "Chefe@DACOM.test" });
        const agent = await loginAs(app, { email: "  CHEFE@dacom.TEST " });

        const res = await agent.get("/api/auth/me");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: user.id, email: "chefe@dacom.test" });
        expect(res.body.roles.sort()).toEqual(["COUNCIL_MEMBER", "HEAD"]);
        expect(res.body.permissions).toContain("votings:open");
    });

    it("o cookie de sessão é httpOnly e SameSite=Lax", async () => {
        const user = await createUser();
        const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
        const cookie = String(res.headers["set-cookie"]);
        expect(cookie).toMatch(/dacom\.sid=/);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Lax/);
    });

    it("senha errada e e-mail inexistente respondem a mesma mensagem", async () => {
        const user = await createUser();
        const wrong = await request(app).post("/api/auth/login").send({ email: user.email, password: "errada-123" });
        const unknown = await request(app).post("/api/auth/login").send({ email: "nao@existe.com", password: "errada-123" });

        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body).toEqual(unknown.body);
    });

    it("usuário desativado ou com convite pendente não entra", async () => {
        const inactive = await createUser({ active: false });
        const pending = await createUser({ password: null });
        expect((await request(app).post("/api/auth/login").send({ email: inactive.email, password: PASSWORD })).status).toBe(401);
        expect((await request(app).post("/api/auth/login").send({ email: pending.email, password: PASSWORD })).status).toBe(401);
    });

    it("dados inválidos respondem 400", async () => {
        const res = await request(app).post("/api/auth/login").send({ email: "x" });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("sem sessão, /me responde 401", async () => {
        expect((await request(app).get("/api/auth/me")).status).toBe(401);
    });

    it("logout encerra a sessão", async () => {
        const user = await createUser();
        const agent = await loginAs(app, user);
        expect((await agent.post("/api/auth/logout").send({})).status).toBe(204);
        expect((await agent.get("/api/auth/me")).status).toBe(401);
    });

    it("desativação e fim de perfil valem na próxima requisição", async () => {
        const user = await createUser({ roles: ["PROFESSOR", "HEAD"] });
        const agent = await loginAs(app, user);

        await prisma.roleAssignment.updateMany({ where: { userId: user.id, role: "HEAD" }, data: { endsAt: new Date() } });
        expect((await agent.get("/api/auth/me")).body.roles).toEqual(["PROFESSOR"]);

        await prisma.user.update({ where: { id: user.id }, data: { active: false } });
        expect((await agent.get("/api/auth/me")).status).toBe(401);
    });

    it("bloqueia após 10 tentativas falhas", async () => {
        const user = await createUser();
        const limitedApp = createApp();
        for (let i = 0; i < 10; i++) {
            await request(limitedApp).post("/api/auth/login").send({ email: user.email, password: "errada-123" });
        }
        const res = await request(limitedApp).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
        expect(res.status).toBe(429);
    });
});

describe("redefinição de senha", () => {
    async function resetTokenFor(email: string) {
        const email_ = await prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: email, template: "PASSWORD_RESET" } });
        return new URL((email_.data as { link: string }).link).searchParams.get("token")!;
    }

    it("e-mail inexistente responde 204 sem enfileirar nada", async () => {
        const res = await request(app).post("/api/auth/password/forgot").send({ email: "nao@existe.com" });
        expect(res.status).toBe(204);
        expect(await prisma.emailOutbox.count()).toBe(0);
    });

    it("token redefine a senha, revoga sessões e não pode ser reutilizado", async () => {
        const user = await createUser();
        const oldSession = await loginAs(app, user);

        expect((await request(app).post("/api/auth/password/forgot").send({ email: user.email })).status).toBe(204);
        const token = await resetTokenFor(user.email);
        expect(await prisma.passwordToken.findFirst({ where: { tokenHash: token } })).toBeNull();

        const reset = await request(app).post("/api/auth/password/reset").send({ token, password: "nova-senha-456" });
        expect(reset.status).toBe(204);

        expect((await oldSession.get("/api/auth/me")).status).toBe(401);
        await loginAs(app, user, "nova-senha-456");

        const reuse = await request(app).post("/api/auth/password/reset").send({ token, password: "outra-senha-789" });
        expect(reuse.status).toBe(422);
    });

    it("token expirado é recusado", async () => {
        const user = await createUser();
        await request(app).post("/api/auth/password/forgot").send({ email: user.email });
        const token = await resetTokenFor(user.email);
        await prisma.passwordToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

        const res = await request(app).post("/api/auth/password/reset").send({ token, password: "nova-senha-456" });
        expect(res.status).toBe(422);
    });

    it("senha curta responde 400", async () => {
        const res = await request(app).post("/api/auth/password/reset").send({ token: "x", password: "123" });
        expect(res.status).toBe(400);
    });
});
