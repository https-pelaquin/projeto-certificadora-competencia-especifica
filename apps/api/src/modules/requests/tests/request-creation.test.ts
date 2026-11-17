import { beforeEach, describe, expect, it } from "vitest";
import { BusinessRuleError, NotFoundError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import {
    balanceOf, D, holdBudgetWithPendingOutflow, insertRequest, ledgerOf, money, setupFinance, stillPending, system, userActor,
} from "../../../test/finance";
import { createBudget } from "../../budget/budget.service";
import { createLimit } from "../../budget/approval-limit.service";
import { createRequest } from "../request-creation.service";

beforeEach(resetDatabase);

async function create(s: Awaited<ReturnType<typeof setupFinance>>, amount: string, overrides: Partial<{ categoryId: number; budgetId: number; description: string }> = {}) {
    return createRequest(userActor(s.requester), {
        categoryId: s.category.id,
        budgetId: s.budget.id,
        description: "Participação em congresso",
        amount: D(amount),
        ...overrides,
    });
}

describe("avaliação automática", () => {
    it("dentro do limite e com saldo: provisiona na hora", async () => {
        const s = await setupFinance();
        const request = await create(s, "1000.00");

        expect(request.status).toBe("PROVISIONED");
        expect(request.approvalLimitId).toBe(s.limit.id);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 1000.00"]);

        const balance = await balanceOf(s.budget.id);
        expect(money(balance.available)).toBe("9000.00");
        expect(money(balance.provisioned)).toBe("1000.00");
    });

    it("dentro do limite e sem saldo: espera saldo, sem lançar nada", async () => {
        const s = await setupFinance({ budget: "500.00" });
        const request = await create(s, "1000.00");

        expect(request.status).toBe("AWAITING_BALANCE");
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("acima do limite: vai para votação, sem lançar nada", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        const request = await create(s, "6000.00");

        expect(request.status).toBe("AWAITING_VOTING");
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("total exatamente igual ao limite ainda está dentro", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        expect((await create(s, "5000.00")).status).toBe("PROVISIONED");
    });

    it("1 centavo acima do limite vai para votação", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        expect((await create(s, "5000.01")).status).toBe("AWAITING_VOTING");
    });

    it("soma o que o professor já pediu", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        expect((await create(s, "4000.00")).status).toBe("PROVISIONED");
        expect((await create(s, "1500.00")).status).toBe("AWAITING_VOTING");
    });

    it("não soma pedidos de outro professor", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        const other = await prisma.user.create({ data: { name: "Outro", email: "outro@dacom.test" } });
        await insertRequest({ requesterId: other.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "4000.00", status: "PROVISIONED" });

        expect((await create(s, "4000.00")).status).toBe("PROVISIONED");
    });

    it("não soma pedidos rejeitados nem cancelados", async () => {
        const s = await setupFinance({ limit: "5000.00" });
        for (const status of ["REJECTED", "CANCELED"] as const) {
            await insertRequest({ requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "4000.00", status });
        }

        expect((await create(s, "4000.00")).status).toBe("PROVISIONED");
    });

    it("só soma o que está dentro da janela do limite", async () => {
        const s = await setupFinance({ limit: "5000.00", periodMonths: 12 });
        const now = new Date();
        const monthsAgo = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15));
        const base = { requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "4000.00", status: "PROVISIONED" as const };
        const input = { categoryId: s.category.id, budgetId: s.budget.id, description: "Congresso", amount: D("4000.00") };

        await insertRequest({ ...base, createdAt: monthsAgo(13) });
        expect((await createRequest(userActor(s.requester), input, now)).status).toBe("PROVISIONED");

        await resetDatabase();
        const s2 = await setupFinance({ limit: "5000.00", periodMonths: 12 });
        await insertRequest({ ...base, requesterId: s2.requester.id, budgetId: s2.budget.id, categoryId: s2.category.id, limitId: s2.limit.id, createdAt: monthsAgo(6) });
        const request = await createRequest(userActor(s2.requester), { ...input, categoryId: s2.category.id, budgetId: s2.budget.id }, now);
        expect(request.status).toBe("AWAITING_VOTING");
    });
});

describe("validações e erros", () => {
    it("sem limite vigente: recusa e não grava nada", async () => {
        const budget = await createBudget(system, { year: 2026, initialAmount: D("10000.00") });
        const category = await prisma.expenseCategory.create({ data: { name: "Eventos" } });
        const user = await prisma.user.create({ data: { name: "Ana", email: "ana@dacom.test" } });

        await expect(createRequest(userActor(user), { categoryId: category.id, budgetId: budget.id, description: "x", amount: D("100.00") }))
            .rejects.toThrow("Não existe limite de aprovação vigente");
        expect(await prisma.request.count()).toBe(0);
    });

    it("recusa valor zero ou negativo", async () => {
        const s = await setupFinance();
        await expect(create(s, "0.00")).rejects.toThrow(BusinessRuleError);
        await expect(create(s, "-5.00")).rejects.toThrow(BusinessRuleError);
        expect(await prisma.request.count()).toBe(0);
    });

    it("recusa descrição vazia", async () => {
        const s = await setupFinance();
        await expect(create(s, "100.00", { description: "   " })).rejects.toThrow(BusinessRuleError);
        expect(await prisma.request.count()).toBe(0);
    });

    it("categoria inexistente: erro de negócio e nada fica gravado", async () => {
        const s = await setupFinance();
        await expect(create(s, "100.00", { categoryId: 999999 })).rejects.toThrow("Categoria inválida");
        expect(await prisma.request.count()).toBe(0);
        expect(await ledgerOf(s.budget.id)).toEqual([]);
    });

    it("orçamento inexistente", async () => {
        const s = await setupFinance();
        await expect(create(s, "100.00", { budgetId: 999999 })).rejects.toThrow(NotFoundError);
    });

    it("audita a criação", async () => {
        const s = await setupFinance();
        const request = await create(s, "100.00");
        const log = await prisma.auditLog.findFirst({ where: { action: "REQUEST_CREATED", entityId: String(request.id) } });
        expect(log?.actorId).toBe(s.requester.id);
    });
});

describe("concorrência", () => {
    it("duas solicitações disputando o mesmo saldo: só uma é provisionada", async () => {
        const s = await setupFinance({ budget: "1000.00", limit: "5000.00" });

        const results = await Promise.all([create(s, "800.00"), create(s, "800.00")]);

        expect(results.map((r) => r.status).sort()).toEqual(["AWAITING_BALANCE", "PROVISIONED"]);
        expect(await ledgerOf(s.budget.id)).toEqual(["PROVISION 800.00"]);
        expect(money((await balanceOf(s.budget.id)).available)).toBe("200.00");
    });

    it("avalia o saldo só depois de outra operação em andamento terminar", async () => {
        const s = await setupFinance({ budget: "1000.00" });
        // Outra operação já travou o orçamento e vai tirar 900 dele; o valor só aparece depois do commit.
        const other = await holdBudgetWithPendingOutflow(s.budget.id, "900.00");

        const creating = create(s, "800.00");
        expect(await stillPending(creating)).toBe(true);

        other.release();
        await other.done;
        const request = await creating;

        // Com o saldo atualizado (100) não cabe: nada foi provisionado em cima de um saldo velho.
        expect(request.status).toBe("AWAITING_BALANCE");
        expect(await ledgerOf(s.budget.id)).toEqual(["ADJUSTMENT_OUT 900.00"]);
    });
});
