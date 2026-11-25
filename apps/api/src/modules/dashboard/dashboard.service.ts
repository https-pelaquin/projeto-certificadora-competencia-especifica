import { Prisma } from "../../../generated/prisma/client";
import { NotFoundError } from "../../shared/errors";
import { balanceOut, moneyOut } from "../../shared/money";
import { prisma, SNAPSHOT } from "../../shared/prisma";
import * as budgetService from "../budget/budget.service";
import * as dashboardRepository from "./dashboard.repository";

const RANKING_SIZE = 5;
const ZERO = new Prisma.Decimal(0);

const dec = (value: Prisma.Decimal | string | null | undefined) => new Prisma.Decimal(value ?? 0);

// Indicadores do ano (RF23): saldo, solicitações por situação, valores por mês e rankings.
// Canceladas ficam fora dos valores por mês e dos rankings. [VALIDAR] o que o cliente quer ver aqui.
export async function getDashboard(year: number) {
    // Todas as consultas na mesma foto do banco: os números do painel precisam bater entre si.
    // Em sequência (e não Promise.all): dentro de uma transação existe uma só conexão.
    const { budget, balance, byStatus, requested, paid, requesters, categories, users, categoryRows } = await prisma.$transaction(async (tx) => {
        const budget = await budgetService.findBudgetByYear(tx, year);
        if (!budget) {
            throw new NotFoundError(`Não há orçamento cadastrado para ${year}`);
        }

        const balance = await budgetService.getBalance(tx, budget.id);
        const byStatus = await dashboardRepository.countByStatus(tx, budget.id);
        const requested = await dashboardRepository.requestedByMonth(tx, budget.id);
        const paid = await dashboardRepository.paidByMonth(tx, budget.id);
        const requesters = await dashboardRepository.topRequesters(tx, budget.id, RANKING_SIZE);
        const categories = await dashboardRepository.topCategories(tx, budget.id, RANKING_SIZE);
        const users = await dashboardRepository.userNames(tx, requesters.map((r) => r.requesterId));
        const categoryRows = await dashboardRepository.categoryNames(tx, categories.map((c) => c.categoryId));

        return { budget, balance, byStatus, requested, paid, requesters, categories, users, categoryRows };
    }, SNAPSHOT);

    const userName = new Map(users.map((u) => [u.id, u.name]));
    const categoryName = new Map(categoryRows.map((c) => [c.id, c.name]));

    const months = new Map<string, { month: string; requested: Prisma.Decimal; requestCount: number; paid: Prisma.Decimal }>();
    const monthOf = (month: string) => months.get(month) ?? months.set(month, { month, requested: ZERO, requestCount: 0, paid: ZERO }).get(month)!;
    for (const row of requested) {
        Object.assign(monthOf(row.month), { requested: dec(row.amount), requestCount: row.count });
    }
    for (const row of paid) {
        Object.assign(monthOf(row.month), { paid: dec(row.amount) });
    }

    return {
        year,
        budget: { id: budget.id, initialAmount: moneyOut(budget.initialAmount) },
        balance: balanceOut(balance),
        requests: {
            total: byStatus.reduce((sum, s) => sum + s._count._all, 0),
            byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all, amount: moneyOut(dec(s._sum.amount)) })),
        },
        byMonth: [...months.values()]
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((m) => ({ month: m.month, requested: moneyOut(m.requested), requestCount: m.requestCount, paid: moneyOut(m.paid) })),
        topRequesters: requesters.map((r) => ({
            id: r.requesterId,
            name: userName.get(r.requesterId) ?? "—",
            count: r._count._all,
            amount: moneyOut(dec(r._sum.amount)),
        })),
        topCategories: categories.map((c) => ({
            id: c.categoryId,
            name: categoryName.get(c.categoryId) ?? "—",
            count: c._count._all,
            amount: moneyOut(dec(c._sum.amount)),
        })),
    };
}
