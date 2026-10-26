import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PasswordTokenPurpose } from "../../../generated/prisma/client";
import { env } from "../../config/env";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, UnauthorizedError } from "../../shared/errors";
import { prisma, type Db } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as notifications from "../notifications/notifications.service";
import * as usersService from "../users/users.service";
import * as authRepository from "./auth.repository";

const TOKEN_TTL_MS: Record<PasswordTokenPurpose, number> = {
    INVITE: 7 * 24 * 60 * 60_000,
    RESET: 60 * 60_000,
};

// Comparar com um hash qualquer quando o e-mail não existe evita revelar cadastros pelo tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", env.BCRYPT_ROUNDS);

export function hashPassword(password: string) {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export async function login(email: string, password: string, context: { ip?: string; requestId?: string }) {
    const user = await usersService.findByEmail(prisma, email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !user.active || !user.passwordHash || !valid) {
        throw new UnauthorizedError("E-mail ou senha inválidos");
    }

    await audit.record(prisma, { type: "USER", userId: user.id, ...context }, { action: "LOGIN", entityType: "User", entityId: user.id });
    return user.id;
}

// Só o hash do token fica no banco; o token em claro vai apenas no link do e-mail.
export async function createPasswordToken(db: Db, userId: number, purpose: PasswordTokenPurpose, now: Date) {
    const token = randomBytes(32).toString("base64url");
    await authRepository.createToken(db, {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
    });
    return { token, link: `${env.APP_URL}/definir-senha?token=${token}` };
}

// Responde igual exista ou não o e-mail (não revela cadastros).
export async function requestPasswordReset(email: string, now = new Date()) {
    await prisma.$transaction(async (tx) => {
        const user = await usersService.findByEmail(tx, email);
        if (!user || !user.active) {
            return;
        }
        const { token, link } = await createPasswordToken(tx, user.id, "RESET", now);
        await notifications.enqueue(tx, {
            template: "PASSWORD_RESET",
            to: user.email,
            dedupeKey: `password-reset:${hashToken(token)}`,
            data: { name: user.name, link },
        });
    });
}

// Serve para aceitar o convite e para redefinir a senha.
export async function setPasswordWithToken(token: string, password: string, context: { ip?: string; requestId?: string }, now = new Date()) {
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
        const stored = await authRepository.findTokenByHash(tx, hashToken(token));
        if (!stored || stored.usedAt || stored.expiresAt <= now || !stored.user.active) {
            throw new BusinessRuleError("Link inválido ou expirado. Solicite um novo.");
        }

        await usersService.setPasswordHash(tx, stored.userId, passwordHash);
        await authRepository.invalidateOpenTokens(tx, stored.userId, now);
        await authRepository.deleteSessionsOf(tx, stored.userId);

        const actor: Actor = { type: "USER", userId: stored.userId, ...context };
        await audit.record(tx, actor, {
            action: stored.purpose === "INVITE" ? "INVITE_ACCEPTED" : "PASSWORD_RESET",
            entityType: "User",
            entityId: stored.userId,
        });
    });
}

export function revokeSessions(db: Db, userId: number) {
    return authRepository.deleteSessionsOf(db, userId);
}
