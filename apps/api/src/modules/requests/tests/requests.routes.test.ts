import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser, loginAs } from "../../../test/factories";
import { D, emailsOf, insertRequest, ledgerOf, setupFinance, system } from "../../../test/finance";
import { adjustBudget } from "../../budget/budget.service";

const app = createApp();

beforeEach(resetDatabase);

async function world(options: Parameters<typeof setupFinance>[0] = {}) {
    const s = await setupFinance(options);
    return { ...s, requesterAgent: await loginAs(app, s.requester), headAgent: await loginAs(app, s.head) };
}
type World = Awaited<ReturnType<typeof world>>;

const newRequest = (w: World, amount = "1000.00") => ({ categoryId: w.category.id, description: "Congresso", amount });

async function create(w: World, amount = "1000.00") {
    const res = await w.requesterAgent.post("/api/requests").send(newRequest(w, amount));
    expect(res.status).toBe(201);
    return res.body as { id: number; status: string };
}

describe("criar", () => {
    it("dentro do limite e com saldo: nasce provisionada, com valores, linha do tempo e e-mail", async () => {
        const w = await world();

        const res = await w.requesterAgent.post("/api/requests").send(newRequest(w, "1000"));

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            status: "PROVISIONED",
            description: "Congresso",
            amount: "1000.00",
            amounts: { requested: "1000.00", provisioned: "1000.00", paid: null },
            requester: { id: w.requester.id },
            category: { id: w.category.id },
            budget: { id: w.budget.id },
            approvalLimit: { id: w.limit.id, amount: "5000.00", periodMonths: 12 },
            payment: null,
            complementRequests: [],
        });
        expect(res.body.timeline).toMatchObject([{ action: "REQUEST_CREATED", toStatus: "PROVISIONED", actor: { id: w.requester.id } }]);
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 1000.00"]);

        const emails = await emailsOf("REQUEST_PROVISIONED");
        expect(emails).toHaveLength(1);
        expect(emails[0]).toMatchObject({ toEmail: w.requester.email, dedupeKey: `request-provisioned:${res.body.id}` });
        expect(emails[0].data).toMatchObject({ requestId: res.body.id, amount: "1000.00" });
    });

    it("acima do limite: aguarda votação, sem lançamento e sem e-mail", async () => {
        const w = await world({ limit: "500.00" });
        const body = await create(w, "1000.00");

        expect(body.status).toBe("AWAITING_VOTING");
        expect(await ledgerOf(w.budget.id)).toEqual([]);
        expect(await emailsOf("REQUEST_PROVISIONED")).toHaveLength(0);
    });

    it("sem saldo: aguarda saldo", async () => {
        const w = await world({ budget: "100.00" });
        expect((await create(w, "1000.00")).status).toBe("AWAITING_BALANCE");
    });

    it("valida o corpo: dinheiro só como texto decimal", async () => {
        const w = await world();
        const ok = newRequest(w);
        for (const bad of [
            { ...ok, amount: 1000 },
            { ...ok, amount: "0" },
            { ...ok, amount: "-1.00" },
            { ...ok, description: "   " },
            { ...ok, categoryId: "1" },
            { description: "x", amount: "1.00" },
        ]) {
            expect((await w.requesterAgent.post("/api/requests").send(bad)).status, JSON.stringify(bad)).toBe(400);
        }
        expect(await prisma.request.count()).toBe(0);
    });

    it("categoria inexistente ou inativa dá 422 e não grava nada", async () => {
        const w = await world();
        const inactive = await prisma.expenseCategory.create({ data: { name: "Antiga", active: false } });

        for (const categoryId of [999999, inactive.id]) {
            const res = await w.requesterAgent.post("/api/requests").send({ ...newRequest(w), categoryId });
            expect(res.status, String(categoryId)).toBe(422);
        }
        expect(await prisma.request.count()).toBe(0);
        expect(await ledgerOf(w.budget.id)).toEqual([]);
    });

    it("sem orçamento no ano corrente: 404", async () => {
        const user = await createUser({ roles: ["PROFESSOR"] });
        const category = await prisma.expenseCategory.create({ data: { name: "Eventos" } });
        const agent = await loginAs(app, user);

        const res = await agent.post("/api/requests").send({ categoryId: category.id, description: "x", amount: "1.00" });
        expect(res.status).toBe(404);
    });

    it("exige sessão e a permissão requests:create", async () => {
        const w = await world();
        expect((await request(app).post("/api/requests").send(newRequest(w))).status).toBe(401);

        const financial = await loginAs(app, await createUser({ roles: ["FINANCIAL_ADMIN"] }));
        expect((await financial.post("/api/requests").send(newRequest(w))).status).toBe(403);
    });

    it("audita a criação com o solicitante", async () => {
        const w = await world();
        const { id } = await create(w);
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "REQUEST_CREATED", entityId: String(id) } });
        expect(log.actorId).toBe(w.requester.id);
    });
});

describe("listar e detalhar", () => {
    async function crowd() {
        const w = await world({ limit: "50000.00" });
        const other = await createUser({ roles: ["PROFESSOR"] });
        const otherAgent = await loginAs(app, other);
        const mine = await create(w, "100.00");
        const mine2 = await create(w, "200.00");
        const theirs = (await otherAgent.post("/api/requests").send(newRequest(w, "300.00"))).body as { id: number };
        return { w, other, otherAgent, mine, mine2, theirs };
    }

    it("o professor vê só as próprias, da mais nova para a mais antiga", async () => {
        const { w, mine, mine2 } = await crowd();
        const res = await w.requesterAgent.get("/api/requests");
        expect(res.body.items.map((r: { id: number }) => r.id)).toEqual([mine2.id, mine.id]);
        expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 2 });
    });

    it("o chefe e o responsável financeiro veem todas", async () => {
        const { w } = await crowd();
        expect((await w.headAgent.get("/api/requests")).body.total).toBe(3);

        const financial = await loginAs(app, await createUser({ roles: ["FINANCIAL_ADMIN"] }));
        expect((await financial.get("/api/requests")).body.total).toBe(3);
    });

    it("filtra por situação, solicitante e página; o filtro de solicitante não vale para quem lê só as próprias", async () => {
        const { w, other, theirs } = await crowd();

        expect((await w.headAgent.get(`/api/requests?requesterId=${other.id}`)).body.items.map((r: { id: number }) => r.id)).toEqual([theirs.id]);
        expect((await w.headAgent.get("/api/requests?status=PAID")).body.total).toBe(0);
        expect((await w.headAgent.get("/api/requests?status=PROVISIONED")).body.total).toBe(3);
        expect((await w.headAgent.get("/api/requests?pageSize=2&page=2")).body.items).toHaveLength(1);

        // tentar espiar o outro professor não funciona: continua vendo só as próprias
        const spy = await w.requesterAgent.get(`/api/requests?requesterId=${other.id}`);
        expect(spy.body.total).toBe(2);
        expect(spy.body.items.every((r: { requester: { id: number } }) => r.requester.id === w.requester.id)).toBe(true);
    });

    it("valida os filtros", async () => {
        const w = await world();
        expect((await w.headAgent.get("/api/requests?status=QUALQUER")).status).toBe(400);
        expect((await w.headAgent.get("/api/requests?page=0")).status).toBe(400);
        expect((await w.headAgent.get("/api/requests?pageSize=101")).status).toBe(400);
        expect((await request(app).get("/api/requests")).status).toBe(401);
    });

    it("detalhe: o dono, o chefe e o responsável financeiro veem; outro professor recebe 404", async () => {
        const { w, mine, otherAgent } = await crowd();

        expect((await w.requesterAgent.get(`/api/requests/${mine.id}`)).status).toBe(200);
        expect((await w.headAgent.get(`/api/requests/${mine.id}`)).status).toBe(200);
        const financial = await loginAs(app, await createUser({ roles: ["FINANCIAL_ADMIN"] }));
        expect((await financial.get(`/api/requests/${mine.id}`)).status).toBe(200);

        expect((await otherAgent.get(`/api/requests/${mine.id}`)).status).toBe(404);
        expect((await w.headAgent.get("/api/requests/999999")).status).toBe(404);
        expect((await w.headAgent.get("/api/requests/abc")).status).toBe(400);
    });

    it("detalhe traz pagamento, valores e a linha do tempo em ordem cronológica, sem dados do auditor", async () => {
        const w = await world();
        const { id } = await create(w, "1000.00");
        await w.headAgent.post(`/api/requests/${id}/payment`).send({ paidAmount: "800.00", justification: "Mais barato" });

        const res = await w.requesterAgent.get(`/api/requests/${id}`);

        expect(res.body.status).toBe("PAID");
        expect(res.body.amounts).toEqual({ requested: "1000.00", provisioned: "0.00", paid: "800.00" });
        expect(res.body.payment).toMatchObject({ paidAmount: "800.00", justification: "Mais barato" });
        expect(res.body.timeline.map((t: { action: string; toStatus: string | null }) => [t.action, t.toStatus])).toEqual([
            ["REQUEST_CREATED", "PROVISIONED"],
            ["REQUEST_STATUS_CHANGED", "PAID"],
        ]);
        expect(JSON.stringify(res.body)).not.toContain("@dacom.test");
    });
});

describe("cancelar", () => {
    it("o solicitante cancela a própria: devolve o saldo e não manda e-mail", async () => {
        const w = await world();
        const { id } = await create(w, "1000.00");

        const res = await w.requesterAgent.post(`/api/requests/${id}/cancel`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELED");
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 1000.00", "RELEASE 1000.00"]);
        expect(await emailsOf("REQUEST_CANCELED")).toHaveLength(0);
    });

    it("outro professor não cancela a alheia", async () => {
        const w = await world();
        const { id } = await create(w);
        const other = await loginAs(app, await createUser({ roles: ["PROFESSOR"] }));

        expect((await other.post(`/api/requests/${id}/cancel`)).status).toBe(403);
        expect((await w.headAgent.get(`/api/requests/${id}`)).body.status).toBe("PROVISIONED");
    });

    it("o chefe cancela a de outra pessoa só com justificativa, e o solicitante é avisado", async () => {
        const w = await world();
        const { id } = await create(w);

        expect((await w.headAgent.post(`/api/requests/${id}/cancel`)).status).toBe(422);
        expect((await w.headAgent.post(`/api/requests/${id}/cancel`).send({ justification: "  " })).status).toBe(422);

        const res = await w.headAgent.post(`/api/requests/${id}/cancel`).send({ justification: "Evento cancelado" });
        expect(res.status).toBe(200);
        expect(res.body.timeline.at(-1)).toMatchObject({ action: "REQUEST_STATUS_CHANGED", toStatus: "CANCELED", justification: "Evento cancelado" });

        const emails = await emailsOf("REQUEST_CANCELED");
        expect(emails).toHaveLength(1);
        expect(emails[0]).toMatchObject({ toEmail: w.requester.email });
        expect(emails[0].data).toMatchObject({ justification: "Evento cancelado" });
    });

    it("não cancela o que já foi pago, e cancelar de novo dá 409", async () => {
        const w = await world();
        const paid = await create(w);
        await w.headAgent.post(`/api/requests/${paid.id}/payment`).send({ paidAmount: "1000.00" });
        expect((await w.requesterAgent.post(`/api/requests/${paid.id}/cancel`)).status).toBe(409);

        const other = await create(w);
        expect((await w.requesterAgent.post(`/api/requests/${other.id}/cancel`)).status).toBe(200);
        expect((await w.requesterAgent.post(`/api/requests/${other.id}/cancel`)).status).toBe(409);
    });
});

describe("provisionar solicitação que aguarda saldo", () => {
    it("o chefe provisiona depois de aumentar o orçamento; o solicitante é avisado", async () => {
        const w = await world({ budget: "500.00" });
        const { id, status } = await create(w, "1000.00");
        expect(status).toBe("AWAITING_BALANCE");

        expect((await w.headAgent.post(`/api/requests/${id}/provision`)).status).toBe(422);

        await adjustBudget(system, w.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });
        const res = await w.headAgent.post(`/api/requests/${id}/provision`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("PROVISIONED");
        expect(res.body.amounts.provisioned).toBe("1000.00");
        expect((await emailsOf("REQUEST_PROVISIONED")).map((e) => e.dedupeKey)).toEqual([`request-provisioned:${id}`]);
        expect((await w.headAgent.post(`/api/requests/${id}/provision`)).status).toBe(409);
    });

    it("professor não provisiona", async () => {
        const w = await world({ budget: "500.00" });
        const { id } = await create(w, "1000.00");
        expect((await w.requesterAgent.post(`/api/requests/${id}/provision`)).status).toBe(403);
    });
});

describe("pedir complementação", () => {
    it("o chefe pede antes da votação: a solicitação aguarda complementação e o solicitante é avisado", async () => {
        const w = await world({ limit: "500.00" });
        const { id } = await create(w, "1000.00");

        const res = await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "Anexe o convite do evento" });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ message: "Anexe o convite do evento", requestStatus: "AWAITING_COMPLEMENT" });

        const detail = (await w.requesterAgent.get(`/api/requests/${id}`)).body;
        expect(detail.status).toBe("AWAITING_COMPLEMENT");
        expect(detail.complementRequests).toMatchObject([{ message: "Anexe o convite do evento", requestedBy: { id: w.head.id } }]);

        const emails = await emailsOf("COMPLEMENT_REQUESTED");
        expect(emails).toHaveLength(1);
        expect(emails[0]).toMatchObject({ toEmail: w.requester.email });
        expect(emails[0].data).toMatchObject({ message: "Anexe o convite do evento" });
    });

    it("durante a votação o status não muda", async () => {
        const w = await world({ limit: "500.00" });
        const inVoting = await insertRequest({ requesterId: w.requester.id, budgetId: w.budget.id, categoryId: w.category.id, limitId: w.limit.id, amount: "1000.00", status: "IN_VOTING" });

        const res = await w.headAgent.post(`/api/requests/${inVoting.id}/complement-requests`).send({ message: "Falta a justificativa" });

        expect(res.status).toBe(201);
        expect(res.body.requestStatus).toBe("IN_VOTING");
        expect((await prisma.request.findUniqueOrThrow({ where: { id: inVoting.id } })).status).toBe("IN_VOTING");
    });

    it("só antes ou durante a votação, só o chefe, e com mensagem", async () => {
        const w = await world();
        const { id } = await create(w);

        expect((await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "x" })).status).toBe(409);
        expect((await w.requesterAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "x" })).status).toBe(403);
        expect((await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "  " })).status).toBe(400);
        expect((await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "x".repeat(2001) })).status).toBe(400);
        expect((await w.headAgent.post("/api/requests/999999/complement-requests").send({ message: "x" })).status).toBe(404);
        expect(await prisma.complementRequest.count()).toBe(0);
    });

    it("pedir de novo enquanto aguarda complementação dá 409", async () => {
        const w = await world({ limit: "500.00" });
        const { id } = await create(w, "1000.00");
        await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "primeiro" });

        expect((await w.headAgent.post(`/api/requests/${id}/complement-requests`).send({ message: "segundo" })).status).toBe(409);
        expect(await prisma.complementRequest.count()).toBe(1);
    });
});
