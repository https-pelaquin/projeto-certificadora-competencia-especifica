import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";

const app = createApp();

beforeEach(resetDatabase);

async function as(role: "HEAD" | "PROFESSOR" | "FINANCIAL_ADMIN") {
    const user = await createUser({ roles: [role] });
    return { user, agent: await loginAs(app, user) };
}

async function createBudget(agent: Awaited<ReturnType<typeof as>>["agent"], initialAmount = "10000.00", year = 2026) {
    const res = await agent.post("/api/budgets").send({ year, initialAmount });
    expect(res.status).toBe(201);
    return res.body as { id: number };
}

describe("permissões", () => {
    it("sem sessão responde 401", async () => {
        expect((await request(app).get("/api/budgets")).status).toBe(401);
        expect((await request(app).post("/api/budgets").send({ year: 2026, initialAmount: "1.00" })).status).toBe(401);
    });

    it("professor não lê nem altera o orçamento", async () => {
        const { agent } = await as("PROFESSOR");
        expect((await agent.get("/api/budgets")).status).toBe(403);
        expect((await agent.post("/api/budgets").send({ year: 2026, initialAmount: "1.00" })).status).toBe(403);
        expect((await agent.post("/api/approval-limits").send({ amount: "100.00", periodMonths: 6 })).status).toBe(403);
    });

    it("responsável financeiro lê, mas não altera", async () => {
        const head = await as("HEAD");
        const { id } = await createBudget(head.agent);
        const { agent } = await as("FINANCIAL_ADMIN");

        expect((await agent.get("/api/budgets")).status).toBe(200);
        expect((await agent.get(`/api/budgets/${id}`)).status).toBe(200);
        expect((await agent.get(`/api/budgets/${id}/ledger`)).status).toBe(200);
        expect((await agent.get("/api/approval-limits")).status).toBe(200);
        expect((await agent.post("/api/budgets").send({ year: 2027, initialAmount: "1.00" })).status).toBe(403);
        expect((await agent.post(`/api/budgets/${id}/adjustments`).send({ type: "ADJUSTMENT_IN", amount: "1.00", justification: "x" })).status).toBe(403);
    });
});

describe("orçamento", () => {
    it("cadastra o orçamento do ano e devolve o saldo com 2 casas", async () => {
        const { agent, user } = await as("HEAD");

        const res = await agent.post("/api/budgets").send({ year: 2026, initialAmount: "10000" });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            year: 2026,
            initialAmount: "10000.00",
            balance: { total: "10000.00", available: "10000.00", provisioned: "0.00", spent: "0.00" },
        });
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "BUDGET_CREATED" } });
        expect(log.actorId).toBe(user.id);
    });

    it("recusa segundo orçamento no mesmo ano", async () => {
        const { agent } = await as("HEAD");
        await createBudget(agent);
        const res = await agent.post("/api/budgets").send({ year: 2026, initialAmount: "5.00" });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("CONFLICT");
    });

    it("dinheiro só entra como texto decimal: número JSON e formato inválido dão 400", async () => {
        const { agent } = await as("HEAD");
        for (const initialAmount of [10000.5, "-5.00", "10,50", "1.234", "abc", ""]) {
            const res = await agent.post("/api/budgets").send({ year: 2026, initialAmount });
            expect(res.status, JSON.stringify(initialAmount)).toBe(400);
        }
        expect(await prisma.budget.count()).toBe(0);
    });

    it("lê um orçamento e lista os do ano mais recente para o mais antigo", async () => {
        const { agent } = await as("HEAD");
        const a = await createBudget(agent, "1000.00", 2025);
        await createBudget(agent, "2000.00", 2026);

        const list = await agent.get("/api/budgets");
        expect(list.body.map((b: { year: number }) => b.year)).toEqual([2026, 2025]);
        expect((await agent.get(`/api/budgets/${a.id}`)).body.initialAmount).toBe("1000.00");
        expect((await agent.get("/api/budgets/999999")).status).toBe(404);
        expect((await agent.get("/api/budgets/abc")).status).toBe(400);
    });
});

describe("ajustes e histórico", () => {
    it("entrada e saída atualizam o saldo, com justificativa", async () => {
        const { agent, user } = await as("HEAD");
        const { id } = await createBudget(agent, "1000.00");

        const entrada = await agent.post(`/api/budgets/${id}/adjustments`).send({ type: "ADJUSTMENT_IN", amount: "500.50", justification: "Suplementação" });
        expect(entrada.status).toBe(201);
        expect(entrada.body.balance).toMatchObject({ total: "1500.50", available: "1500.50" });

        const saida = await agent.post(`/api/budgets/${id}/adjustments`).send({ type: "ADJUSTMENT_OUT", amount: "300.00", justification: "Corte" });
        expect(saida.body.balance).toMatchObject({ total: "1200.50", available: "1200.50" });

        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "BUDGET_ADJUSTED" }, orderBy: { id: "desc" } });
        expect(log.justification).toBe("Corte");
        expect(log.actorId).toBe(user.id);
    });

    it("saída maior que o disponível dá 422 e nada é gravado", async () => {
        const { agent } = await as("HEAD");
        const { id } = await createBudget(agent, "1000.00");

        const res = await agent.post(`/api/budgets/${id}/adjustments`).send({ type: "ADJUSTMENT_OUT", amount: "1000.01", justification: "Corte" });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe("BUSINESS_RULE");
        expect(await prisma.ledgerEntry.count()).toBe(0);
    });

    it("exige tipo válido, valor positivo e justificativa", async () => {
        const { agent } = await as("HEAD");
        const { id } = await createBudget(agent);
        const url = `/api/budgets/${id}/adjustments`;
        const ok = { type: "ADJUSTMENT_IN", amount: "10.00", justification: "x" };

        for (const bad of [
            { ...ok, type: "PROVISION" },
            { ...ok, type: "SPEND" },
            { ...ok, amount: "0" },
            { ...ok, amount: 10 },
            { ...ok, justification: "   " },
            { type: "ADJUSTMENT_IN", amount: "10.00" },
        ]) {
            expect((await agent.post(url).send(bad)).status, JSON.stringify(bad)).toBe(400);
        }
        expect((await agent.post("/api/budgets/999999/adjustments").send(ok)).status).toBe(404);
        expect(await prisma.ledgerEntry.count()).toBe(0);
    });

    it("histórico traz quem fez cada lançamento, do mais recente ao mais antigo, paginado", async () => {
        const { agent, user } = await as("HEAD");
        const { id } = await createBudget(agent);
        for (const amount of ["1.00", "2.00", "3.00"]) {
            await agent.post(`/api/budgets/${id}/adjustments`).send({ type: "ADJUSTMENT_IN", amount, justification: `+${amount}` });
        }

        const first = await agent.get(`/api/budgets/${id}/ledger?pageSize=2`);
        expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
        expect(first.body.items.map((e: { amount: string }) => e.amount)).toEqual(["3.00", "2.00"]);
        expect(first.body.items[0]).toMatchObject({ type: "ADJUSTMENT_IN", justification: "+3.00", createdBy: { id: user.id } });

        const second = await agent.get(`/api/budgets/${id}/ledger?pageSize=2&page=2`);
        expect(second.body.items.map((e: { amount: string }) => e.amount)).toEqual(["1.00"]);
        expect((await agent.get("/api/budgets/999999/ledger")).status).toBe(404);
    });
});

describe("limite de aprovação", () => {
    it("cadastra, lista o mais recente primeiro e encerra o anterior", async () => {
        const { agent } = await as("HEAD");

        const first = await agent.post("/api/approval-limits").send({ amount: "1000", periodMonths: 6, validFrom: "2026-01-01T00:00:00Z" });
        expect(first.status).toBe(201);
        expect(first.body).toMatchObject({ amount: "1000.00", periodMonths: 6, validUntil: null });

        await agent.post("/api/approval-limits").send({ amount: "3000.00", periodMonths: 12, validFrom: "2026-06-01T00:00:00Z" });

        const list = await agent.get("/api/approval-limits");
        expect(list.body.map((l: { amount: string }) => l.amount)).toEqual(["3000.00", "1000.00"]);
        expect(list.body[1].validUntil).toBe("2026-06-01T00:00:00.000Z");
        expect(list.body[0].validUntil).toBeNull();
    });

    it("sem data, vale a partir de agora", async () => {
        const { agent } = await as("HEAD");
        const before = Date.now();
        const res = await agent.post("/api/approval-limits").send({ amount: "1000.00", periodMonths: 6 });
        expect(new Date(res.body.validFrom).getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it("início anterior ao último limite dá 422", async () => {
        const { agent } = await as("HEAD");
        await agent.post("/api/approval-limits").send({ amount: "1000.00", periodMonths: 6, validFrom: "2026-06-01T00:00:00Z" });
        const res = await agent.post("/api/approval-limits").send({ amount: "2000.00", periodMonths: 6, validFrom: "2026-03-01T00:00:00Z" });
        expect(res.status).toBe(422);
        expect(await prisma.approvalLimit.count()).toBe(1);
    });

    it("valida valor, período e data", async () => {
        const { agent } = await as("HEAD");
        for (const bad of [
            { amount: "0", periodMonths: 6 },
            { amount: 1000, periodMonths: 6 },
            { amount: "1000.00", periodMonths: 0 },
            { amount: "1000.00", periodMonths: 6.5 },
            { amount: "1000.00", periodMonths: 6, validFrom: "ontem" },
        ]) {
            expect((await agent.post("/api/approval-limits").send(bad)).status, JSON.stringify(bad)).toBe(400);
        }
    });
});
