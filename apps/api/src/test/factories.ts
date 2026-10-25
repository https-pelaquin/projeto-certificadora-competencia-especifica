import request from "supertest";
import type { Express } from "express";
import type { Role } from "../../generated/prisma/client";
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
