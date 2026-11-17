import { beforeEach, describe, expect, it } from "vitest";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser } from "../../../test/factories";
import {
    authUser, balanceOf, D, holdBudgetWithPendingOutflow, holdRequestWithStatus, insertRequest, ledgerOf, money, setupFinance, stillPending, system, userActor,
} from "../../../test/finance";
import { adjustBudget } from "../../budget/budget.service";
import { openVoting } from "../../votings/votings.service";
import { cancelRequest } from "../request-cancellation.service";
import { createRequest } from "../request-creation.service";
import { provisionRequest } from "../requests.service";

beforeEach(resetDatabase);

type Scenario = Awaited<ReturnType<typeof setupFinance>>;

function insert(s: Scenario, amount: string, status: Parameters<typeof insertRequest>[0]["status"]) {
    return insertRequest({ requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount, status });
}

async function statusOf(id: number) {
    return (await prisma.request.findUniqueOrThrow({ where: { id } })).status;
}

describe("provisionar (AWAITING_BALANCE → PROVISIONED)", () => {
    async function waitingForBalance() {
        const s = await setupFinance({ budget: "500.00" });
        const request = await createRequest(userActor(s.requester), {
            categoryId: s.category.id, budgetId: s.budget.id, description: "Congresso", amount: D("1000.00"),
        });
        expect(request.status).toBe("AWAITING_BALANCE");
        return { s, request };
    }

    it("sem saldo continua esperando e não lança nada", async () => {
        const { s, request } = await waitingForBalance();

        await expect(provisionRequest(userActor(s.head), request.id)).rejects.toThrow(BusinessRuleError);
        expect(await statusOf(request.id)).toBe("AWAITING_BALANCE");
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("depois de o chefe aumentar o orçamento, provisiona", async () => {
        const { s, request } = await waitingForBalance();
        await adjustBudget(system, s.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });

        const after = await provisionRequest(userActor(s.head), request.id);

        expect(after.status).toBe("PROVISIONED");
        expect(await ledgerOf(s.budget.id)).toEqual(["ADJUSTMENT_IN 1000.00", "PROVISION 1000.00"]);
        expect(money((await balanceOf(s.budget.id)).available)).toBe("500.00");
    });

    it("repetir a chamada não provisiona duas vezes", async () => {
        const { s, request } = await waitingForBalance();
        await adjustBudget(system, s.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });

        await provisionRequest(userActor(s.head), request.id);
        await expect(provisionRequest(userActor(s.head), request.id)).rejects.toThrow(ConflictError);

        expect((await ledgerOf(s.budget.id)).filter((e) => e.startsWith("PROVISION"))).toEqual(["PROVISION 1000.00"]);
    });

    it("duas chamadas simultâneas: uma vence, a outra recebe conflito", async () => {
        const { s, request } = await waitingForBalance();
        await adjustBudget(system, s.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });

        const results = await Promise.allSettled([
            provisionRequest(userActor(s.head), request.id),
            provisionRequest(userActor(s.head), request.id),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
        expect(rejected.reason).toBeInstanceOf(ConflictError);
        expect((await ledgerOf(s.budget.id)).filter((e) => e.startsWith("PROVISION"))).toEqual(["PROVISION 1000.00"]);
    });

    it("só vale para solicitação que aguarda saldo", async () => {
        const s = await setupFinance();
        for (const status of ["AWAITING_VOTING", "PROVISIONED", "PAID", "CANCELED"] as const) {
            const request = await insert(s, "100.00", status);
            await expect(provisionRequest(userActor(s.head), request.id)).rejects.toThrow(ConflictError);
        }
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("solicitação inexistente", async () => {
        const s = await setupFinance();
        await expect(provisionRequest(userActor(s.head), 999999)).rejects.toThrow(NotFoundError);
    });

    it("confere o saldo só depois de outra operação em andamento terminar", async () => {
        const { s, request } = await waitingForBalance();
        await adjustBudget(system, s.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });
        // Há 1.500 disponíveis; outra operação já travou o orçamento e vai tirar 900 (só vale depois do commit).
        const other = await holdBudgetWithPendingOutflow(s.budget.id, "900.00");

        const provisioning = provisionRequest(userActor(s.head), request.id);
        const outcome = expect(provisioning).rejects.toThrow(BusinessRuleError);
        expect(await stillPending(provisioning)).toBe(true);

        other.release();
        await other.done;
        await outcome;

        // Com 600 disponíveis não cabe: nada foi provisionado em cima de um saldo velho.
        expect(await statusOf(request.id)).toBe("AWAITING_BALANCE");
        expect((await ledgerOf(s.budget.id)).filter((e) => e.startsWith("PROVISION"))).toEqual([]);
    });

    it("espera outra operação em andamento na própria solicitação", async () => {
        const { s, request } = await waitingForBalance();
        await adjustBudget(system, s.budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_IN", justification: "Suplementação" });
        const other = await holdRequestWithStatus(request.id, "CANCELED");

        const provisioning = provisionRequest(userActor(s.head), request.id);
        const outcome = expect(provisioning).rejects.toThrow(ConflictError);
        expect(await stillPending(provisioning)).toBe(true);

        other.release();
        await other.done;
        await outcome;

        expect(await statusOf(request.id)).toBe("CANCELED");
        expect((await ledgerOf(s.budget.id)).filter((e) => e.startsWith("PROVISION"))).toEqual([]);
    });
});

describe("cancelar", () => {
    async function provisioned(s: Scenario, amount = "1000.00") {
        return createRequest(userActor(s.requester), {
            categoryId: s.category.id, budgetId: s.budget.id, description: "Congresso", amount: D(amount),
        });
    }

    it("o solicitante cancela a própria provisionada: o valor volta ao disponível", async () => {
        const s = await setupFinance();
        const request = await provisioned(s);

        const after = await cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), request.id);

        expect(after.status).toBe("CANCELED");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "RELEASE 1000.00"]);
        const balance = await balanceOf(s.budget.id);
        expect(money(balance.available)).toBe("10000.00");
        expect(money(balance.provisioned)).toBe("0.00");
    });

    it("cancelar quem ainda não provisionou não lança nada", async () => {
        const s = await setupFinance();
        for (const status of ["AWAITING_VOTING", "AWAITING_BALANCE", "AWAITING_COMPLEMENT"] as const) {
            const request = await insert(s, "100.00", status);
            const after = await cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), request.id);
            expect(after.status).toBe("CANCELED");
        }
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("outro professor não cancela a solicitação alheia", async () => {
        const s = await setupFinance();
        const request = await provisioned(s);
        const other = await createUser({ roles: ["PROFESSOR"] });

        await expect(cancelRequest(userActor(other), authUser(other, ["PROFESSOR"]), request.id)).rejects.toThrow(ForbiddenError);
        expect(await statusOf(request.id)).toBe("PROVISIONED");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
    });

    it("o chefe cancela a de outro, mas só com justificativa", async () => {
        const s = await setupFinance();
        const request = await provisioned(s);
        const head = authUser(s.head, ["HEAD"]);

        await expect(cancelRequest(userActor(s.head), head, request.id)).rejects.toThrow(BusinessRuleError);
        await expect(cancelRequest(userActor(s.head), head, request.id, { justification: "   " })).rejects.toThrow(BusinessRuleError);
        expect(await statusOf(request.id)).toBe("PROVISIONED");

        await cancelRequest(userActor(s.head), head, request.id, { justification: "Evento cancelado" });
        expect(await statusOf(request.id)).toBe("CANCELED");

        const release = await prisma.ledgerEntry.findFirstOrThrow({ where: { requestId: request.id, type: "RELEASE" } });
        expect(release.justification).toBe("Evento cancelado");
        expect(release.createdById).toBe(s.head.id);
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "REQUEST_STATUS_CHANGED", entityId: String(request.id) }, orderBy: { id: "desc" } });
        expect(log.justification).toBe("Evento cancelado");
    });

    it("não cancela o que já foi pago, rejeitado ou cancelado", async () => {
        const s = await setupFinance();
        for (const status of ["PAID", "REJECTED", "CANCELED"] as const) {
            const request = await insert(s, "100.00", status);
            await expect(cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), request.id)).rejects.toThrow(ConflictError);
            expect(await statusOf(request.id)).toBe(status);
        }
    });

    it("solicitação inexistente", async () => {
        const s = await setupFinance();
        await expect(cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), 999999)).rejects.toThrow(NotFoundError);
    });

    it("cancelar duas vezes ao mesmo tempo devolve o valor uma só vez", async () => {
        const s = await setupFinance();
        const request = await provisioned(s);
        const user = authUser(s.requester, ["PROFESSOR"]);

        const results = await Promise.allSettled([
            cancelRequest(userActor(s.requester), user, request.id),
            cancelRequest(userActor(s.requester), user, request.id),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "RELEASE 1000.00"]);
    });

    it("espera outra operação em andamento na própria solicitação", async () => {
        const s = await setupFinance();
        const request = await provisioned(s);
        const other = await holdRequestWithStatus(request.id, "PAID");

        const canceling = cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), request.id);
        const outcome = expect(canceling).rejects.toThrow(ConflictError);
        expect(await stillPending(canceling)).toBe(true);

        other.release();
        await other.done;
        await outcome;

        // Foi pago enquanto esperava: o cancelamento não pode devolver um saldo que já virou gasto.
        expect(await statusOf(request.id)).toBe("PAID");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
    });

    it("cancela também a votação aberta", async () => {
        const s = await setupFinance({ limit: "500.00" });
        await createUser({ roles: ["COUNCIL_MEMBER"] });
        await createUser({ roles: ["COUNCIL_MEMBER"] });
        const request = await provisioned(s, "1000.00");
        expect(request.status).toBe("AWAITING_VOTING");

        const voting = await openVoting(userActor(s.head), request.id, new Date(Date.now() + 60 * 60_000));
        expect(await statusOf(request.id)).toBe("IN_VOTING");

        await cancelRequest(userActor(s.requester), authUser(s.requester, ["PROFESSOR"]), request.id);

        expect(await statusOf(request.id)).toBe("CANCELED");
        expect((await prisma.voting.findUniqueOrThrow({ where: { id: voting!.id } })).status).toBe("CANCELED");
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });
});
