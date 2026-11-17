import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";
import { D, emailsOf, ledgerOf, setupFinance, userActor } from "../../../test/finance";
import { createRequest } from "../../requests/request-creation.service";

const app = createApp();

beforeEach(resetDatabase);

async function provisioned(options: Parameters<typeof setupFinance>[0] = {}, amount = "1000.00") {
    const s = await setupFinance(options);
    const created = await createRequest(userActor(s.requester), { categoryId: s.category.id, description: "Congresso", amount: D(amount) });
    expect(created.status).toBe("PROVISIONED");
    return { ...s, request: created, headAgent: await loginAs(app, s.head), requesterAgent: await loginAs(app, s.requester) };
}

const pay = (w: Awaited<ReturnType<typeof provisioned>>, body: object) => w.headAgent.post(`/api/requests/${w.request.id}/payment`).send(body);

describe("permissões", () => {
    it("só quem tem payments:record paga", async () => {
        const w = await provisioned();
        expect((await request(app).post(`/api/requests/${w.request.id}/payment`).send({ paidAmount: "1000.00" })).status).toBe(401);
        expect((await w.requesterAgent.post(`/api/requests/${w.request.id}/payment`).send({ paidAmount: "1000.00" })).status).toBe(403);

        const financial = await loginAs(app, await createUser({ roles: ["FINANCIAL_ADMIN"] }));
        expect((await financial.post(`/api/requests/${w.request.id}/payment`).send({ paidAmount: "1000.00" })).status).toBe(403);
        expect(await prisma.payment.count()).toBe(0);
    });
});

describe("registrar pagamento", () => {
    it("igual ao provisionado: devolve o pagamento e o saldo, avisa o solicitante e audita", async () => {
        const w = await provisioned();

        const res = await pay(w, { paidAmount: "1000" });

        expect(res.status).toBe(201);
        expect(res.body.payment).toMatchObject({ requestId: w.request.id, paidAmount: "1000.00", justification: null });
        expect(res.body.balance).toEqual({ total: "10000.00", available: "9000.00", provisioned: "0.00", spent: "1000.00" });

        const emails = await emailsOf("PAYMENT_RECORDED");
        expect(emails).toHaveLength(1);
        expect(emails[0]).toMatchObject({ toEmail: w.requester.email, dedupeKey: `payment-recorded:${res.body.payment.id}` });
        expect(emails[0].data).toMatchObject({ paidAmount: "1000.00" });
        expect(await prisma.auditLog.count({ where: { action: "PAYMENT_RECORDED", actorId: w.head.id } })).toBe(1);
    });

    it("menor: exige justificativa e devolve a diferença ao disponível", async () => {
        const w = await provisioned();

        expect((await pay(w, { paidAmount: "700.00" })).status).toBe(422);
        expect((await pay(w, { paidAmount: "700.00", justification: "   " })).status).toBe(422);
        expect(await prisma.payment.count()).toBe(0);

        const res = await pay(w, { paidAmount: "700.00", justification: "Hospedagem mais barata" });
        expect(res.status).toBe(201);
        expect(res.body.balance).toEqual({ total: "10000.00", available: "9300.00", provisioned: "0.00", spent: "700.00" });
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 1000.00", "SPEND 700.00", "RELEASE 300.00"]);
    });

    it("maior: provisiona a diferença se houver saldo; senão 422 e nada é gravado", async () => {
        const rich = await provisioned();
        const res = await pay(rich, { paidAmount: "1200.00", justification: "Taxa de inscrição" });
        expect(res.status).toBe(201);
        expect(res.body.balance).toMatchObject({ available: "8800.00", spent: "1200.00", provisioned: "0.00" });
    });

    it("maior sem saldo para a diferença", async () => {
        const w = await provisioned({ budget: "1000.00" });
        const res = await pay(w, { paidAmount: "1200.00", justification: "Taxa" });
        expect(res.status).toBe(422);
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 1000.00"]);
        expect(await prisma.payment.count()).toBe(0);
    });

    it("não paga duas vezes nem o que não está provisionado", async () => {
        const w = await provisioned();
        expect((await pay(w, { paidAmount: "1000.00" })).status).toBe(201);
        expect((await pay(w, { paidAmount: "1000.00" })).status).toBe(409);
        expect(await prisma.payment.count()).toBe(1);

        const waiting = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "grande", amount: D("20000.00") });
        expect(waiting.status).toBe("AWAITING_VOTING");
        expect((await w.headAgent.post(`/api/requests/${waiting.id}/payment`).send({ paidAmount: "20000.00" })).status).toBe(409);
        expect((await w.headAgent.post("/api/requests/999999/payment").send({ paidAmount: "1.00" })).status).toBe(404);
    });

    it("dinheiro só como texto decimal positivo", async () => {
        const w = await provisioned();
        for (const bad of [{ paidAmount: 1000 }, { paidAmount: "0" }, { paidAmount: "-5.00" }, { paidAmount: "1,5" }, {}, { paidAmount: "1.00", justification: "x".repeat(501) }]) {
            expect((await pay(w, bad)).status, JSON.stringify(bad)).toBe(400);
        }
        expect(await prisma.payment.count()).toBe(0);
    });
});
