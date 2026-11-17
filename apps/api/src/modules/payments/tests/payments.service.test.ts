import { beforeEach, describe, expect, it } from "vitest";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import {
    balanceOf, D, holdBudgetWithPendingOutflow, holdRequestWithStatus, ledgerOf, money, setupFinance, stillPending, userActor,
} from "../../../test/finance";
import { createRequest } from "../../requests/request-creation.service";
import { recordPayment } from "../payments.service";

beforeEach(resetDatabase);

// Solicitação já provisionada: o orçamento fica com `budget - amount` disponível.
async function provisioned(options: { budget?: string; amount?: string } = {}) {
    const s = await setupFinance({ budget: options.budget });
    const request = await createRequest(userActor(s.requester), {
        categoryId: s.category.id, budgetId: s.budget.id, description: "Congresso", amount: D(options.amount ?? "1000.00"),
    });
    expect(request.status).toBe("PROVISIONED");
    return { s, request };
}

async function statusOf(id: number) {
    return (await prisma.request.findUniqueOrThrow({ where: { id } })).status;
}

function expectInvariant(balance: Awaited<ReturnType<typeof balanceOf>>) {
    expect(balance.available.plus(balance.provisioned).plus(balance.spent).equals(balance.total)).toBe(true);
}

describe("valor pago igual ao provisionado", () => {
    it("transforma o provisionado em utilizado", async () => {
        const { s, request } = await provisioned();

        const { payment, balance } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") });

        expect(payment.recordedById).toBe(s.head.id);
        expect(await statusOf(request.id)).toBe("PAID");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "SPEND 1000.00"]);
        expect(money(balance.available)).toBe("9000.00");
        expect(money(balance.provisioned)).toBe("0.00");
        expect(money(balance.spent)).toBe("1000.00");
        expectInvariant(balance);
    });

    it("não exige justificativa", async () => {
        const { s, request } = await provisioned();
        const { payment } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") });
        expect(payment.justification).toBeNull();
    });
});

describe("valor pago menor que o provisionado", () => {
    it("gasta o pago e devolve a diferença ao disponível", async () => {
        const { s, request } = await provisioned();

        const { balance } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("700.00"), justification: "Hospedagem mais barata" });

        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "SPEND 700.00", "RELEASE 300.00"]);
        expect(money(balance.available)).toBe("9300.00");
        expect(money(balance.provisioned)).toBe("0.00");
        expect(money(balance.spent)).toBe("700.00");
        expectInvariant(balance);
    });

    it("sem justificativa: recusa e não grava nada", async () => {
        const { s, request } = await provisioned();

        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("700.00") })).rejects.toThrow(BusinessRuleError);
        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("700.00"), justification: "  " })).rejects.toThrow(BusinessRuleError);

        expect(await statusOf(request.id)).toBe("PROVISIONED");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
        expect(await prisma.payment.count()).toBe(0);
    });

    it("grava a justificativa no pagamento, no lançamento e na auditoria", async () => {
        const { s, request } = await provisioned();
        const { payment } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("700.00"), justification: "Hospedagem mais barata" });

        expect(payment.justification).toBe("Hospedagem mais barata");
        const spend = await prisma.ledgerEntry.findFirstOrThrow({ where: { requestId: request.id, type: "SPEND" } });
        expect(spend.justification).toBe("Hospedagem mais barata");
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "PAYMENT_RECORDED", entityId: String(payment.id) } });
        expect(log.justification).toBe("Hospedagem mais barata");
        expect(log.actorId).toBe(s.head.id);
    });
});

describe("valor pago maior que o provisionado", () => {
    it("provisiona a diferença e gasta o total, se houver saldo", async () => {
        const { s, request } = await provisioned();

        const { balance } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("1200.00"), justification: "Taxa de inscrição" });

        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "PROVISION 200.00", "SPEND 1200.00"]);
        expect(money(balance.available)).toBe("8800.00");
        expect(money(balance.provisioned)).toBe("0.00");
        expect(money(balance.spent)).toBe("1200.00");
        expectInvariant(balance);
    });

    it("sem saldo para a diferença: recusa e não grava nada", async () => {
        const { s, request } = await provisioned({ budget: "1000.00", amount: "1000.00" });

        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("1200.00"), justification: "Taxa" }))
            .rejects.toThrow("O saldo disponível não cobre a diferença do pagamento");

        expect(await statusOf(request.id)).toBe("PROVISIONED");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
        expect(await prisma.payment.count()).toBe(0);
    });

    it("aceita pagar exatamente o que cabe no saldo", async () => {
        const { s, request } = await provisioned({ budget: "1200.00", amount: "1000.00" });
        const { balance } = await recordPayment(userActor(s.head), request.id, { paidAmount: D("1200.00"), justification: "Taxa" });
        expect(money(balance.available)).toBe("0.00");
    });

    it("sem justificativa: recusa", async () => {
        const { s, request } = await provisioned();
        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("1200.00") })).rejects.toThrow(BusinessRuleError);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
    });
});

describe("validações", () => {
    it("recusa valor zero ou negativo", async () => {
        const { s, request } = await provisioned();
        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("0.00") })).rejects.toThrow(BusinessRuleError);
        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("-10.00"), justification: "x" })).rejects.toThrow(BusinessRuleError);
    });

    it("só paga solicitação provisionada", async () => {
        const s = await setupFinance({ budget: "100.00" });
        const waiting = await createRequest(userActor(s.requester), {
            categoryId: s.category.id, budgetId: s.budget.id, description: "Sem saldo", amount: D("500.00"),
        });
        expect(waiting.status).toBe("AWAITING_BALANCE");

        await expect(recordPayment(userActor(s.head), waiting.id, { paidAmount: D("500.00") })).rejects.toThrow(ConflictError);
        expect(await prisma.payment.count()).toBe(0);
    });

    it("solicitação inexistente", async () => {
        const { s } = await provisioned();
        await expect(recordPayment(userActor(s.head), 999999, { paidAmount: D("10.00") })).rejects.toThrow(NotFoundError);
    });
});

describe("travas", () => {
    it("confere o saldo da diferença só depois de outra operação em andamento terminar", async () => {
        const { s, request } = await provisioned({ budget: "1000.00", amount: "800.00" });
        // Sobram 200; outra operação já travou o orçamento e vai tirar 150 (só vale depois do commit).
        const other = await holdBudgetWithPendingOutflow(s.budget.id, "150.00");

        const paying = recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00"), justification: "Taxa" });
        const outcome = expect(paying).rejects.toThrow("O saldo disponível não cobre a diferença do pagamento");
        expect(await stillPending(paying)).toBe(true);

        other.release();
        await other.done;
        await outcome;

        // Com 50 disponíveis a diferença de 200 não cabe: o pagamento não passou por cima de um saldo velho.
        expect(await statusOf(request.id)).toBe("PROVISIONED");
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 800.00", "ADJUSTMENT_OUT 150.00"]);
    });

    it("espera outra operação em andamento na própria solicitação", async () => {
        const { s, request } = await provisioned();
        const other = await holdRequestWithStatus(request.id, "CANCELED");

        const paying = recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") });
        const outcome = expect(paying).rejects.toThrow(ConflictError);
        expect(await stillPending(paying)).toBe(true);

        other.release();
        await other.done;
        await outcome;

        expect(await prisma.payment.count()).toBe(0);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);
    });
});

describe("pagamento duplicado", () => {
    it("repetir a chamada não paga duas vezes", async () => {
        const { s, request } = await provisioned();
        await recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") });

        await expect(recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") })).rejects.toThrow(ConflictError);

        expect(await prisma.payment.count()).toBe(1);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "SPEND 1000.00"]);
    });

    it("duas chamadas simultâneas: uma paga, a outra recebe conflito", async () => {
        const { s, request } = await provisioned();

        const results = await Promise.allSettled([
            recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") }),
            recordPayment(userActor(s.head), request.id, { paidAmount: D("1000.00") }),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
        expect(await prisma.payment.count()).toBe(1);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00", "SPEND 1000.00"]);
    });
});
