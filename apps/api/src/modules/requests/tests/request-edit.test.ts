import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { loginAs } from "../../../test/factories";
import { D, emailsOf, holdBudgetWithPendingOutflow, insertRequest, ledgerOf, setupFinance, stillPending, userActor } from "../../../test/finance";
import { createRequest } from "../request-creation.service";
import { editRequest } from "../request-edit.service";

const app = createApp();

beforeEach(resetDatabase);

async function world(options: Parameters<typeof setupFinance>[0] = {}) {
    const s = await setupFinance(options);
    return { ...s, requesterAgent: await loginAs(app, s.requester), headAgent: await loginAs(app, s.head) };
}
type World = Awaited<ReturnType<typeof world>>;

function insert(w: World, amount: string, status: Parameters<typeof insertRequest>[0]["status"]) {
    return insertRequest({ requesterId: w.requester.id, budgetId: w.budget.id, categoryId: w.category.id, limitId: w.limit.id, amount, status });
}

const edit = (w: World, id: number, body: object) => w.requesterAgent.patch(`/api/requests/${id}`).send(body);

async function statusOf(id: number) {
    return (await prisma.request.findUniqueOrThrow({ where: { id } })).status;
}

describe("quem pode editar e quando", () => {
    it("só o solicitante edita; o chefe recebe 403", async () => {
        const w = await world();
        const request = await insert(w, "1000.00", "AWAITING_VOTING");

        expect((await w.headAgent.patch(`/api/requests/${request.id}`).send({ description: "outro texto" })).status).toBe(403);
        expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).description).toBe("Cenário de teste");
    });

    it("não edita o que já foi pago, rejeitado ou cancelado", async () => {
        const w = await world();
        for (const status of ["PAID", "REJECTED", "CANCELED"] as const) {
            const request = await insert(w, "100.00", status);
            expect((await edit(w, request.id, { description: "novo" })).status, status).toBe(409);
        }
    });

    it("solicitação inexistente", async () => {
        const w = await world();
        expect((await edit(w, 999999, { description: "novo" })).status).toBe(404);
    });

    it("valida o corpo", async () => {
        const w = await world();
        const request = await insert(w, "100.00", "AWAITING_VOTING");
        for (const bad of [{}, { description: "   " }, { amount: 100 }, { amount: "0" }, { categoryId: "1" }]) {
            expect((await edit(w, request.id, bad)).status, JSON.stringify(bad)).toBe(400);
        }
    });
});

describe("texto e categoria até o pagamento", () => {
    it("na provisionada muda só o texto: sem novo lançamento e sem trocar o status", async () => {
        const w = await world();
        const created = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "Congresso", amount: D("1000.00") });
        const ledgerBefore = await ledgerOf(w.budget.id);

        const res = await edit(w, created.id, { description: "  Congresso em Curitiba  " });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "PROVISIONED", description: "Congresso em Curitiba" });
        expect(await ledgerOf(w.budget.id)).toEqual(ledgerBefore);
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "REQUEST_UPDATED", entityId: String(created.id) } });
        expect(log.actorId).toBe(w.requester.id);
        expect(log.before).toMatchObject({ description: "Congresso" });
        expect(log.after).toMatchObject({ description: "Congresso em Curitiba" });
    });

    it("muda a categoria para outra ativa, mas não para inativa ou inexistente", async () => {
        const w = await world();
        const request = await insert(w, "100.00", "AWAITING_VOTING");
        const other = await prisma.expenseCategory.create({ data: { name: "Diárias" } });
        const inactive = await prisma.expenseCategory.create({ data: { name: "Antiga", active: false } });

        expect((await edit(w, request.id, { categoryId: other.id })).body.category.id).toBe(other.id);
        expect((await edit(w, request.id, { categoryId: inactive.id })).status).toBe(422);
        expect((await edit(w, request.id, { categoryId: 999999 })).status).toBe(422);
    });

    it("em votação o texto muda e o valor fica travado", async () => {
        const w = await world();
        const request = await insert(w, "1000.00", "IN_VOTING");

        expect((await edit(w, request.id, { description: "mais detalhes" })).status).toBe(200);
        const locked = await edit(w, request.id, { amount: "500.00" });
        expect(locked.status).toBe(422);
        expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).amount.toFixed(2)).toBe("1000.00");
        expect(await statusOf(request.id)).toBe("IN_VOTING");
    });

    it("aguardando saldo também tem o valor travado", async () => {
        const w = await world({ budget: "100.00" });
        const waiting = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("1000.00") });
        expect(waiting.status).toBe("AWAITING_BALANCE");

        expect((await edit(w, waiting.id, { amount: "50.00" })).status).toBe(422);
        expect((await edit(w, waiting.id, { description: "só o texto" })).status).toBe(200);
    });

    it("provisionada também tem o valor travado, e o ledger não muda", async () => {
        const w = await world();
        const provisioned = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("1000.00") });

        expect((await edit(w, provisioned.id, { amount: "50.00" })).status).toBe(422);
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 1000.00"]);
    });

    it("repetir o mesmo valor não conta como mudança de valor", async () => {
        const w = await world();
        const created = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("1000.00") });
        const res = await edit(w, created.id, { amount: "1000.00", description: "y" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("PROVISIONED");
    });
});

describe("mudar o valor antes da votação reavalia", () => {
    it("baixando para dentro do limite, vira provisionada e o solicitante é avisado", async () => {
        const w = await world({ limit: "5000.00" });
        const request = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("6000.00") });
        expect(request.status).toBe("AWAITING_VOTING");

        const res = await edit(w, request.id, { amount: "4000.00" });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "PROVISIONED", amount: "4000.00", amounts: { provisioned: "4000.00" } });
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 4000.00"]);
        expect((await emailsOf("REQUEST_PROVISIONED")).map((e) => e.dedupeKey)).toEqual([`request-provisioned:${request.id}`]);
        expect(res.body.timeline.map((t: { action: string }) => t.action)).toEqual(["REQUEST_CREATED", "REQUEST_UPDATED", "REQUEST_STATUS_CHANGED"]);
    });

    it("continuando acima do limite, segue aguardando votação e nada é lançado", async () => {
        const w = await world({ limit: "5000.00" });
        const request = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("9000.00") });

        const res = await edit(w, request.id, { amount: "6000.00" });

        expect(res.body).toMatchObject({ status: "AWAITING_VOTING", amount: "6000.00" });
        expect(await ledgerOf(w.budget.id)).toEqual([]);
    });

    it("subindo para acima do limite, passa a aguardar votação", async () => {
        const w = await world({ limit: "5000.00" });
        const request = await insert(w, "1000.00", "AWAITING_VOTING");
        const res = await edit(w, request.id, { amount: "7000.00" });
        expect(res.body.status).toBe("AWAITING_VOTING");
    });

    it("grava o limite vigente na reavaliação", async () => {
        const w = await world({ limit: "5000.00" });
        const request = await insert(w, "6000.00", "AWAITING_VOTING");
        const res = await edit(w, request.id, { amount: "4000.00" });
        expect(res.body.approvalLimit.id).toBe(w.limit.id);
    });

    it("sem saldo, passa a aguardar saldo", async () => {
        const w = await world({ budget: "100.00", limit: "5000.00" });
        const request = await insert(w, "6000.00", "AWAITING_VOTING");
        const res = await edit(w, request.id, { amount: "4000.00" });
        expect(res.body.status).toBe("AWAITING_BALANCE");
        expect(await ledgerOf(w.budget.id)).toEqual([]);
    });

    it("não conta a própria solicitação duas vezes no acumulado", async () => {
        const w = await world({ limit: "5000.00" });
        // 2.000 já provisionados + esta de 3.000 = exatamente o limite: tem que caber.
        await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "primeira", amount: D("2000.00") });
        const awaiting = await insert(w, "3000.00", "AWAITING_COMPLEMENT");

        const res = await edit(w, awaiting.id, { description: "complementada" });

        expect(res.body.status).toBe("PROVISIONED");
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 2000.00", "PROVISION 3000.00"]);
    });
});

describe("complementação: do pedido do chefe à nova avaliação", () => {
    it("o chefe pede, o solicitante edita o valor para baixo e a solicitação é provisionada", async () => {
        const w = await world({ limit: "5000.00" });
        const created = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("8000.00") });
        expect(created.status).toBe("AWAITING_VOTING");

        await w.headAgent.post(`/api/requests/${created.id}/complement-requests`).send({ message: "O valor parece alto" });
        expect(await statusOf(created.id)).toBe("AWAITING_COMPLEMENT");

        const res = await edit(w, created.id, { amount: "4500.00", description: "Valor revisado" });

        expect(res.body.status).toBe("PROVISIONED");
        expect(res.body.timeline.map((t: { action: string }) => t.action)).toEqual([
            "REQUEST_CREATED",
            "COMPLEMENT_REQUESTED",
            "REQUEST_STATUS_CHANGED",
            "REQUEST_UPDATED",
            "REQUEST_STATUS_CHANGED",
        ]);
        expect(await ledgerOf(w.budget.id)).toEqual(["PROVISION 4500.00"]);
    });

    it("editar sem mudar o valor volta a aguardar votação se continua acima do limite", async () => {
        const w = await world({ limit: "5000.00" });
        const created = await createRequest(userActor(w.requester), { categoryId: w.category.id, description: "x", amount: D("8000.00") });
        await w.headAgent.post(`/api/requests/${created.id}/complement-requests`).send({ message: "Detalhe a finalidade" });

        const res = await edit(w, created.id, { description: "Finalidade detalhada" });

        expect(res.body.status).toBe("AWAITING_VOTING");
        expect(await ledgerOf(w.budget.id)).toEqual([]);
    });
});

describe("travas", () => {
    it("reavalia só depois de outra operação em andamento no orçamento terminar", async () => {
        const w = await world({ budget: "5000.00", limit: "10000.00" });
        const request = await insert(w, "9000.00", "AWAITING_VOTING");
        // Cabem 4.000 hoje; outra operação já travou o orçamento e vai tirar 2.000 (só vale depois do commit).
        const other = await holdBudgetWithPendingOutflow(w.budget.id, "2000.00");

        const editing = editRequest(userActor(w.requester), request.id, { amount: D("4000.00") });
        const outcome = editing.then((r) => r.status);
        expect(await stillPending(editing)).toBe(true);

        other.release();
        await other.done;

        // Com 3.000 disponíveis, 4.000 não cabem: não foi provisionado em cima de um saldo velho.
        expect(await outcome).toBe("AWAITING_BALANCE");
        expect(await ledgerOf(w.budget.id)).toEqual(["ADJUSTMENT_OUT 2000.00"]);
    });
});
