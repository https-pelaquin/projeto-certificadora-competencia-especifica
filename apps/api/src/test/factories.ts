import request from "supertest";
import type { Express } from "express";
import { Prisma, type RequestStatus, type Role } from "../../generated/prisma/client";
import { prisma } from "../shared/prisma";
import { hashPassword } from "../modules/auth/auth.service";

export const PASSWORD = "senha-segura-123";

let sequence = 0;

export async function createUser(options: { roles?: Role[]; name?: string; email?: string; password?: string | null; active?: boolean } = {}) {
    sequence++;
    const password = options.password === undefined ? PASSWORD : options.password;
    return prisma.user.create({
        data: {
            name: options.name ?? `Usuário ${sequence}`,
            email: (options.email ?? `user${sequence}@dacom.test`).toLowerCase(),
            passwordHash: password === null ? null : await hashPassword(password),
            active: options.active ?? true,
            roleAssignments: {
                create: (options.roles ?? ["PROFESSOR"]).map((role) => ({ role, startsAt: new Date(Date.now() - 60_000) })),
            },
        },
    });
}

export async function loginAs(app: Express, user: { email: string }, password = PASSWORD) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email: user.email, password });
    if (res.status !== 204) {
        throw new Error(`login falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return agent;
}

// Monta orçamento, limite e categoria quando ainda não existem e cria a solicitação direto no status pedido.
export async function createRequest(options: { requesterId: number; amount?: string; status?: RequestStatus; budget?: string }) {
    const year = new Date().getUTCFullYear();
    const budget = await prisma.budget.upsert({
        where: { year },
        update: {},
        create: { year, initialAmount: new Prisma.Decimal(options.budget ?? "10000.00") },
    });
    const limit = (await prisma.approvalLimit.findFirst())
        ?? (await prisma.approvalLimit.create({ data: { amount: new Prisma.Decimal("1000.00"), periodMonths: 12, validFrom: new Date(0) } }));
    const category = await prisma.expenseCategory.upsert({ where: { name: "Eventos" }, update: {}, create: { name: "Eventos" } });

    return prisma.request.create({
        data: {
            requesterId: options.requesterId,
            categoryId: category.id,
            budgetId: budget.id,
            approvalLimitId: limit.id,
            description: "Participação em congresso",
            amount: new Prisma.Decimal(options.amount ?? "2500.00"),
            status: options.status ?? "AWAITING_VOTING",
        },
    });
}
