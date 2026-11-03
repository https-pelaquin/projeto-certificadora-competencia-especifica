import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";
import { D, insertRequest, setupFinance, userActor } from "../../../test/finance";
import { recordPayment } from "../../payments/payments.service";
import { createRequest } from "../../requests/request-creation.service";

const app = createApp();

beforeEach(resetDatabase);

// Mês de hoje no fuso de Brasília, que é o fuso usado nos agrupamentos.
const thisMonth = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
const thisYear = new Date().getUTCFullYear();

describe("permissões", () => {
    it("só chefe e responsável financeiro leem", async () => {
        await setupFinance();
        expect((await request(app).get("/api/dashboard")).status).toBe(401);

        for (const role of ["PROFESSOR", "COUNCIL_MEMBER"] as const) {
            const agent = await loginAs(app, await createUser({ roles: [role] }));
            expect((await agent.get("/api/dashboard")).status, role).toBe(403);
        }
        for (const role of ["FINANCIAL_ADMIN"] as const) {
            const agent = await loginAs(app, await createUser({ roles: [role] }));
            expect((await agent.get("/api/dashboard")).status, role).toBe(200);
        }
    });

    it("ano sem orçamento dá 404, ano inválido dá 400", async () => {
        const s = await setupFinance();
        const agent = await loginAs(app, s.head);
        expect((await agent.get(`/api/dashboard?year=${thisYear - 5}`)).status).toBe(404);
        expect((await agent.get("/api/dashboard?year=abc")).status).toBe(400);
        expect((await agent.get("/api/dashboard?year=1999")).status).toBe(400);
    });
});

describe("indicadores", () => {
    it("orçamento sem solicitações: tudo zerado", async () => {
        const s = await setupFinance({ budget: "10000.00" });
        const res = await (await loginAs(app, s.head)).get("/api/dashboard");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            year: thisYear,
            budget: { initialAmount: "10000.00" },
            balance: { total: "10000.00", available: "10000.00", provisioned: "0.00", spent: "0.00" },
            requests: { total: 0, byStatus: [] },
            byMonth: [],
            topRequesters: [],
            topCategories: [],
        });
    });

    it("soma saldo, situações, valores por mês e rankings; canceladas ficam fora dos valores e rankings", async () => {
        const s = await setupFinance({ budget: "20000.00", limit: "5000.00" });
        const bia = await createUser({ roles: ["PROFESSOR"], name: "Bia" });
        const category2 = await prisma.expenseCategory.create({ data: { name: "Diárias" } });

        // Ana (s.requester): 1.000 provisionada e 500 paga.
        await createRequest(userActor(s.requester), { categoryId: s.category.id, description: "a", amount: D("1000.00") });
        const toPay = await createRequest(userActor(s.requester), { categoryId: s.category.id, description: "b", amount: D("500.00") });
        await recordPayment(userActor(s.head), toPay.id, { paidAmount: D("500.00") });
        // Bia: 6.000 acima do limite, aguardando votação, em outra categoria.
        await createRequest(userActor(bia), { categoryId: category2.id, description: "c", amount: D("6000.00") });
        // Cancelada de Bia: aparece na contagem por situação, mas não nos valores nem nos rankings.
        await insertRequest({ requesterId: bia.id, budgetId: s.budget.id, categoryId: category2.id, limitId: s.limit.id, amount: "700.00", status: "CANCELED" });

        const res = await (await loginAs(app, s.head)).get("/api/dashboard");

        expect(res.body.balance).toEqual({ total: "20000.00", available: "18500.00", provisioned: "1000.00", spent: "500.00" });
        expect(res.body.requests.total).toBe(4);
        const byStatus = Object.fromEntries(res.body.requests.byStatus.map((s: { status: string; count: number; amount: string }) => [s.status, [s.count, s.amount]]));
        expect(byStatus).toEqual({
            PROVISIONED: [1, "1000.00"],
            PAID: [1, "500.00"],
            AWAITING_VOTING: [1, "6000.00"],
            CANCELED: [1, "700.00"],
        });
        expect(res.body.byMonth).toEqual([{ month: thisMonth, requested: "7500.00", requestCount: 3, paid: "500.00" }]);
        expect(res.body.topRequesters).toEqual([
            { id: bia.id, name: "Bia", count: 1, amount: "6000.00" },
            { id: s.requester.id, name: s.requester.name, count: 2, amount: "1500.00" },
        ]);
        expect(res.body.topCategories).toEqual([
            { id: category2.id, name: "Diárias", count: 1, amount: "6000.00" },
            { id: s.category.id, name: "Eventos", count: 2, amount: "1500.00" },
        ]);
    });

    it("limita os rankings a 5 e ordena pelo valor", async () => {
        const s = await setupFinance({ budget: "100000.00", limit: "50000.00" });
        for (let i = 1; i <= 7; i++) {
            const user = await createUser({ roles: ["PROFESSOR"], name: `Prof ${i}` });
            await createRequest(userActor(user), { categoryId: s.category.id, description: "x", amount: D(`${i * 100}.00`) });
        }

        const res = await (await loginAs(app, s.head)).get("/api/dashboard");

        expect(res.body.topRequesters).toHaveLength(5);
        expect(res.body.topRequesters.map((r: { name: string }) => r.name)).toEqual(["Prof 7", "Prof 6", "Prof 5", "Prof 4", "Prof 3"]);
    });

    it("aceita o ano pela query", async () => {
        const s = await setupFinance();
        await prisma.budget.create({ data: { year: thisYear - 1, initialAmount: D("777.00") } });
        const res = await (await loginAs(app, s.head)).get(`/api/dashboard?year=${thisYear - 1}`);
        expect(res.body).toMatchObject({ year: thisYear - 1, balance: { total: "777.00" } });
    });
});
