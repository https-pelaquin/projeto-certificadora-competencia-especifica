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
export async function tryProvision(db: Db, actor: Actor, data: { budgetId: number; requestId: number; amount: Prisma.Decimal }) {
    const balance = await getBalance(db, data.budgetId);
    if (balance.available.lessThan(data.amount)) {
        return false;
    }

    await budgetRepository.createLedgerEntry(db, { ...data, type: "PROVISION", createdById: actorUserId(actor) });
    return true;
}

export function findBudgetById(id: number) {
    return budgetRepository.findById(prisma, id);
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
