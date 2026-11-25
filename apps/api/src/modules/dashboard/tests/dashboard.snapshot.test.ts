import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { D, insertRequest, setupFinance, system } from "../../../test/finance";
import * as budgetRepository from "../../budget/budget.repository";
import { adjustBudget, listLedger } from "../../budget/budget.service";
import * as dashboardRepository from "../dashboard.repository";
import { getDashboard } from "../dashboard.service";

beforeEach(resetDatabase);

// Simula "outra pessoa" gravando no meio da leitura: o gancho roda logo depois de uma consulta do relatório,
// numa conexão própria (fora da transação do relatório), e já com commit feito.
it("dashboard: uma solicitação nova no meio da leitura não desencontra os totais", async () => {
    const s = await setupFinance();
    const base = { requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "100.00", status: "PROVISIONED" as const };
    await insertRequest(base);

    const original = dashboardRepository.countByStatus;
    const spy = vi.spyOn(dashboardRepository, "countByStatus").mockImplementation((async (db: Parameters<typeof original>[0], budgetId: number) => {
        const result = await original(db, budgetId);
        await insertRequest(base); // chega depois da contagem por status, antes das consultas seguintes
        return result;
    }) as never);

    const dashboard = await getDashboard(s.budget.year);
    spy.mockRestore();

    const byMonth = dashboard.byMonth.reduce((sum, m) => sum + m.requestCount, 0);
    expect(dashboard.requests.total).toBe(byMonth);
    expect(await prisma.request.count()).toBe(2); // a solicitação nova existe, só não entrou nesta foto
});

it("histórico do ledger: página e total vêm do mesmo instante", async () => {
    const s = await setupFinance();
    await adjustBudget(system, s.budget.id, { amount: D("10.00"), type: "ADJUSTMENT_IN", justification: "x" });

    const original = budgetRepository.listLedger;
    const spy = vi.spyOn(budgetRepository, "listLedger").mockImplementation((async (db: Parameters<typeof original>[0], budgetId: number, page: Parameters<typeof original>[2]) => {
        const result = await original(db, budgetId, page);
        await adjustBudget(system, budgetId, { amount: D("5.00"), type: "ADJUSTMENT_IN", justification: "y" });
        return result;
    }) as never);

    const ledger = await listLedger(s.budget.id, 1, 50);
    spy.mockRestore();

    expect(ledger.total).toBe(ledger.items.length);
});
