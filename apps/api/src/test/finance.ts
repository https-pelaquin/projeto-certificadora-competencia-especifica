import { Prisma, type RequestStatus, type Role } from "../../generated/prisma/client";
import { createLimit } from "../modules/budget/approval-limit.service";
import { createBudget, getBalance } from "../modules/budget/budget.service";
import { permissionsFor } from "../modules/auth/permissions";
import { prisma, type Db } from "../shared/prisma";
import type { AuthUser } from "../types/express";
import { createUser } from "./factories";

export const D = (v: string) => new Prisma.Decimal(v);
export const system = { type: "SYSTEM", job: "test" } as const;

// Orçamento do ano corrente (é o que a criação de solicitação usa), limite vigente, categoria, um professor e o chefe.
export async function setupFinance(options: { budget?: string; limit?: string; periodMonths?: number } = {}) {
    const budget = await createBudget(system, { year: new Date().getUTCFullYear(), initialAmount: D(options.budget ?? "10000.00") });
    const limit = await createLimit(system, {
        amount: D(options.limit ?? "5000.00"),
        periodMonths: options.periodMonths ?? 12,
        validFrom: new Date("2020-01-01T00:00:00Z"),
    });
    const category = await prisma.expenseCategory.create({ data: { name: "Eventos" } });
    const requester = await createUser({ roles: ["PROFESSOR"] });
    const head = await createUser({ roles: ["HEAD"] });
    return { budget, limit, category, requester, head };
}

export const userActor = (user: { id: number }) => ({ type: "USER", userId: user.id }) as const;

export function authUser(user: { id: number; name: string; email: string }, roles: Role[]): AuthUser {
    return { id: user.id, name: user.name, email: user.email, roles, permissions: permissionsFor(roles) };
}

// Grava a solicitação direto no banco, sem avaliação, para montar o cenário.
export function insertRequest(options: {
    requesterId: number;
    budgetId: number;
    categoryId: number;
    limitId: number;
    amount: string;
    status: RequestStatus;
    createdAt?: Date;
}) {
    return prisma.request.create({
        data: {
            requesterId: options.requesterId,
            budgetId: options.budgetId,
            categoryId: options.categoryId,
            approvalLimitId: options.limitId,
            description: "Cenário de teste",
            amount: D(options.amount),
            status: options.status,
            createdAt: options.createdAt,
        },
    });
}

// Segura uma transação aberta (e o que ela travou/alterou) até `release()`: simula outra operação em andamento.
export async function holdTransaction(work: (tx: Db) => Promise<void>) {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let ready!: () => void;
    const isReady = new Promise<void>((resolve) => (ready = resolve));

    const done = prisma.$transaction(async (tx) => {
        await work(tx);
        ready();
        await hold;
    });
    await isReady;
    return { release: () => release(), done };
}

// Verdadeiro se a promessa ainda não terminou depois de `ms`: ficou esperando um lock.
export async function stillPending(promise: Promise<unknown>, ms = 400) {
    let settled = false;
    promise.then(() => (settled = true), () => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, ms));
    return !settled;
}

// Trava a linha do orçamento e lança um ajuste negativo que só vale depois do commit.
export function holdBudgetWithPendingOutflow(budgetId: number, amount: string) {
    return holdTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Budget" WHERE id = ${budgetId} FOR UPDATE`;
        await tx.ledgerEntry.create({ data: { budgetId, type: "ADJUSTMENT_OUT", amount: D(amount) } });
    });
}

// Trava a solicitação e muda o status dela; a mudança só vale depois do commit.
export function holdRequestWithStatus(requestId: number, status: RequestStatus) {
    return holdTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
        await tx.request.update({ where: { id: requestId }, data: { status } });
    });
}

export const balanceOf = (budgetId: number) => getBalance(prisma, budgetId);

export async function ledgerOf(budgetId: number) {
    const entries = await prisma.ledgerEntry.findMany({ where: { budgetId }, orderBy: { id: "asc" } });
    return entries.map((e) => `${e.type} ${e.amount.toFixed(2)}`);
}

export const money = (value: Prisma.Decimal) => value.toFixed(2);

export function emailsOf(template: string) {
    return prisma.emailOutbox.findMany({ where: { template }, orderBy: { id: "asc" } });
}
