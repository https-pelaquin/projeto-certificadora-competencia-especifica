import { LedgerEntryType, Prisma } from "../../../generated/prisma/client";
import { prisma, type Db } from "../../shared/prisma";
import { actorUserId, type Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../shared/errors";
import * as audit from "../audit/audit.service";
import * as budgetRepository from "./budget.repository";

const ZERO = new Prisma.Decimal(0);

export async function createBudget(actor: Actor, data: { year: number; initialAmount: Prisma.Decimal }) {
    try {
        return await prisma.$transaction(async (tx) => {
            const budget = await budgetRepository.create(tx, { ...data, createdById: actorUserId(actor) });
            await audit.record(tx, actor, { action: "BUDGET_CREATED", entityType: "Budget", entityId: budget.id, after: budget });
            return budget;
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ConflictError(`Já existe orçamento para o ano ${data.year}`);
        }
        throw error;
    }
}

export async function adjustBudget(actor: Actor, budgetId: number, data: {
    amount: Prisma.Decimal;
    type: Extract<LedgerEntryType, "ADJUSTMENT_IN" | "ADJUSTMENT_OUT">;
    justification: string;
}) {
    if (data.amount.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError("O valor do ajuste deve ser maior que zero");
    }

    return prisma.$transaction(async (tx) => {
        await lockBudget(tx, budgetId);

        if (data.type === "ADJUSTMENT_OUT") {
            const balance = await getBalance(tx, budgetId);
            if (balance.available.lessThan(data.amount)) {
                throw new BusinessRuleError("O saldo disponível não pode ficar negativo");
            }
        }

        const entry = await budgetRepository.createLedgerEntry(tx, { budgetId, ...data, createdById: actorUserId(actor) });
        await audit.record(tx, actor, {
            action: "BUDGET_ADJUSTED",
            entityType: "Budget",
            entityId: budgetId,
            after: entry,
            justification: data.justification,
        });

        return getBalance(tx, budgetId);
    });
}

export async function lockBudget(db: Db, budgetId: number) {
    if (!(await budgetRepository.lock(db, budgetId))) {
        throw new NotFoundError("Orçamento não encontrado");
    }
}

export async function getBalance(db: Db, budgetId: number) {
    const budget = await budgetRepository.findById(db, budgetId);
    if (!budget) {
        throw new NotFoundError("Orçamento não encontrado");
    }

    const sums = await budgetRepository.sumLedgerByType(db, budgetId);
    const sumOf = (type: LedgerEntryType) => sums.find((s) => s.type === type)?._sum.amount ?? ZERO;

    const total = budget.initialAmount.plus(sumOf("ADJUSTMENT_IN")).minus(sumOf("ADJUSTMENT_OUT"));
    const available = total.minus(sumOf("PROVISION")).plus(sumOf("RELEASE"));
    const provisioned = sumOf("PROVISION").minus(sumOf("RELEASE")).minus(sumOf("SPEND"));
    const spent = sumOf("SPEND");

    return { total, available, provisioned, spent };
}

// Provisiona se houver saldo. Exige o lock do orçamento (lockBudget) na mesma transação.
export async function tryProvision(db: Db, actor: Actor, data: {
    budgetId: number;
    requestId: number;
    amount: Prisma.Decimal;
    justification?: string;
}) {
    const balance = await getBalance(db, data.budgetId);
    if (balance.available.lessThan(data.amount)) {
        return false;
    }

    await budgetRepository.createLedgerEntry(db, { ...data, type: "PROVISION", createdById: actorUserId(actor) });
    return true;
}

type RequestEntry = { budgetId: number; requestId: number; amount: Prisma.Decimal; justification?: string };

// Devolve ao disponível o que estava provisionado. Exige o lock do orçamento na mesma transação.
export function release(db: Db, actor: Actor, data: RequestEntry) {
    return budgetRepository.createLedgerEntry(db, { ...data, type: "RELEASE", createdById: actorUserId(actor) });
}

// Registra o gasto (provisionado vira utilizado). Exige o lock do orçamento na mesma transação.
export function spend(db: Db, actor: Actor, data: RequestEntry) {
    return budgetRepository.createLedgerEntry(db, { ...data, type: "SPEND", createdById: actorUserId(actor) });
}

// Quanto ainda está provisionado para a solicitação: PROVISION − RELEASE − SPEND dos lançamentos dela.
export async function getRequestProvisioned(db: Db, requestId: number) {
    const sums = await budgetRepository.sumLedgerByTypeForRequest(db, requestId);
    const sumOf = (type: LedgerEntryType) => sums.find((s) => s.type === type)?._sum.amount ?? ZERO;

    return sumOf("PROVISION").minus(sumOf("RELEASE")).minus(sumOf("SPEND"));
}

export function findBudgetById(id: number) {
    return budgetRepository.findById(prisma, id);
}

export function findBudgetByYear(db: Db, year: number) {
    return budgetRepository.findByYear(db, year);
}

export async function listBudgets() {
    const budgets = await budgetRepository.list(prisma);
    return Promise.all(budgets.map(async (budget) => ({ budget, balance: await getBalance(prisma, budget.id) })));
}

export async function getBudgetDetail(id: number) {
    const budget = await budgetRepository.findById(prisma, id);
    if (!budget) {
        throw new NotFoundError("Orçamento não encontrado");
    }
    return { budget, balance: await getBalance(prisma, id) };
}

// Histórico do ledger, do mais recente ao mais antigo.
export async function listLedger(budgetId: number, page: number, pageSize: number) {
    if (!(await budgetRepository.findById(prisma, budgetId))) {
        throw new NotFoundError("Orçamento não encontrado");
    }
    const [items, total] = await Promise.all([
        budgetRepository.listLedger(prisma, budgetId, { skip: (page - 1) * pageSize, take: pageSize }),
        budgetRepository.countLedger(prisma, budgetId),
    ]);
    return { items, page, pageSize, total };
}

export async function getAnnualSummary(year: number) {
    const budget = await budgetRepository.findByYear(prisma, year);
    if (!budget) {
        throw new NotFoundError(`Não há orçamento cadastrado para ${year}`);
    }

    const [balance, requests] = await Promise.all([
        getBalance(prisma, budget.id),
        prisma.request.findMany({
            where: { budgetId: budget.id },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                description: true,
                amount: true,
                status: true,
                createdAt: true,
                requester: { select: { name: true } },
                category: { select: { name: true } },
                payment: { select: { paidAmount: true, paidAt: true } },
            },
        }),
    ]);

    return { year, initialAmount: budget.initialAmount, balance, requests };
}
