import { Prisma, type Role } from "../../../generated/prisma/client";
import { actorUserId, type Actor } from "../../shared/actor";
import { addMonths } from "../../shared/dates";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../shared/errors";
import { prisma, type Db } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as authService from "../auth/auth.service";
import * as notifications from "../notifications/notifications.service";
import * as usersRepository from "./users.repository";

const HEAD_TERM_MONTHS = 24;

type UserWithAssignments = NonNullable<Awaited<ReturnType<typeof usersRepository.findWithAssignments>>>;

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function isCurrent(assignment: { startsAt: Date; endsAt: Date | null }, now: Date) {
    return assignment.startsAt <= now && (assignment.endsAt === null || assignment.endsAt > now);
}

// Resposta pública: nunca expõe o hash da senha.
function toResponse(user: UserWithAssignments, now: Date) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        invitePending: user.passwordHash === null,
        createdAt: user.createdAt,
        roles: [...new Set(user.roleAssignments.filter((a) => isCurrent(a, now)).map((a) => a.role))],
        roleAssignments: user.roleAssignments.map((a) => ({
            id: a.id,
            role: a.role,
            startsAt: a.startsAt,
            endsAt: a.endsAt,
            current: isCurrent(a, now),
        })),
    };
}

export async function findActiveWithCurrentRoles(db: Db, id: number, now: Date) {
    const user = await usersRepository.findWithCurrentRoles(db, id, now);
    if (!user || !user.active) {
        return null;
    }
    const roles = [...new Set(user.roleAssignments.map((a) => a.role))];
    return { id: user.id, name: user.name, email: user.email, roles };
}

export function findByEmail(db: Db, email: string) {
    return usersRepository.findByEmail(db, normalizeEmail(email));
}

export function findById(db: Db, id: number) {
    return usersRepository.findById(db, id);
}

export function setPasswordHash(db: Db, id: number, passwordHash: string) {
    return usersRepository.update(db, id, { passwordHash });
}

export function findActiveWithRole(db: Db, role: Role, now: Date) {
    return usersRepository.findActiveWithRoleAt(db, role, now);
}

export async function listUsers(now = new Date()) {
    const users = await usersRepository.list(prisma);
    return users.map((u) => toResponse(u, now));
}

export async function getUser(id: number, now = new Date()) {
    const user = await usersRepository.findWithAssignments(prisma, id);
    if (!user) {
        throw new NotFoundError("Usuário não encontrado");
    }
    return toResponse(user, now);
}

async function sendInvite(db: Db, user: { id: number; name: string; email: string }, now: Date) {
    const { link } = await authService.createPasswordToken(db, user.id, "INVITE", now);
    await notifications.enqueue(db, {
        template: "INVITE",
        to: user.email,
        dedupeKey: `invite:${user.id}:${now.getTime()}`,
        data: { name: user.name, link },
    });
}

export async function inviteUser(actor: Actor, data: { name: string; email: string; roles: Role[] }, now = new Date()) {
    try {
        const userId = await prisma.$transaction(async (tx) => {
            const user = await usersRepository.create(tx, { name: data.name, email: normalizeEmail(data.email) });
            for (const role of data.roles) {
                await createAssignment(tx, actor, user.id, { role, startsAt: now }, now);
            }
            await sendInvite(tx, user, now);
            await audit.record(tx, actor, {
                action: "USER_INVITED",
                entityType: "User",
                entityId: user.id,
                after: { ...user, roles: data.roles },
            });
            return user.id;
        });
        return getUser(userId, now);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ConflictError("Já existe um usuário com este e-mail");
        }
        throw error;
    }
}

export async function resendInvite(actor: Actor, userId: number, now = new Date()) {
    await prisma.$transaction(async (tx) => {
        const user = await usersRepository.findById(tx, userId);
        if (!user) {
            throw new NotFoundError("Usuário não encontrado");
        }
        if (user.passwordHash !== null) {
            throw new ConflictError("O usuário já aceitou o convite");
        }
        if (!user.active) {
            throw new BusinessRuleError("Usuário desativado");
        }
        await sendInvite(tx, user, now);
        await audit.record(tx, actor, { action: "INVITE_RESENT", entityType: "User", entityId: user.id });
    });
}

export async function updateUser(actor: Actor, id: number, data: { name?: string; active?: boolean }, now = new Date()) {
    if (data.active === false && actorUserId(actor) === id) {
        throw new BusinessRuleError("Você não pode desativar a própria conta");
    }

    await prisma.$transaction(async (tx) => {
        const before = await usersRepository.findById(tx, id);
        if (!before) {
            throw new NotFoundError("Usuário não encontrado");
        }
        const after = await usersRepository.update(tx, id, data);
        if (data.active === false) {
            await authService.revokeSessions(tx, id);
        }
        await audit.record(tx, actor, { action: "USER_UPDATED", entityType: "User", entityId: id, before, after });
    });
    return getUser(id, now);
}

// Mandato de chefe = 2 anos quando o fim não é informado.
async function createAssignment(db: Db, actor: Actor, userId: number, data: { role: Role; startsAt?: Date; endsAt?: Date }, now: Date) {
    const startsAt = data.startsAt ?? now;
    const endsAt = data.endsAt ?? (data.role === "HEAD" ? addMonths(startsAt, HEAD_TERM_MONTHS) : null);

    if (endsAt && endsAt <= startsAt) {
        throw new BusinessRuleError("O fim da vigência deve ser depois do início");
    }
    if (await usersRepository.findOverlapping(db, { role: data.role, startsAt, endsAt, userId })) {
        throw new ConflictError("O usuário já tem este perfil no período informado");
    }
    if (data.role === "HEAD" && (await usersRepository.findOverlapping(db, { role: "HEAD", startsAt, endsAt }))) {
        throw new ConflictError("Já existe um chefe com vigência no período informado");
    }

    return usersRepository.createAssignment(db, { userId, role: data.role, startsAt, endsAt, assignedById: actorUserId(actor) });
}

export async function assignRole(actor: Actor, userId: number, data: { role: Role; startsAt?: Date; endsAt?: Date }, now = new Date()) {
    await prisma.$transaction(async (tx) => {
        const user = await usersRepository.findById(tx, userId);
        if (!user) {
            throw new NotFoundError("Usuário não encontrado");
        }
        const assignment = await createAssignment(tx, actor, userId, data, now);
        await audit.record(tx, actor, { action: "ROLE_ASSIGNED", entityType: "RoleAssignment", entityId: assignment.id, after: assignment });
    });
    return getUser(userId, now);
}

// Encerrar = preencher endsAt; a atribuição nunca é apagada (histórico de mandatos).
export async function endRole(actor: Actor, userId: number, assignmentId: number, data: { endsAt?: Date }, now = new Date()) {
    await prisma.$transaction(async (tx) => {
        const before = await usersRepository.findAssignment(tx, assignmentId);
        if (!before || before.userId !== userId) {
            throw new NotFoundError("Atribuição de perfil não encontrada");
        }
        if (before.endsAt && before.endsAt <= now) {
            throw new ConflictError("Esta atribuição já foi encerrada");
        }

        const requested = data.endsAt ?? now;
        // Atribuição futura encerrada antes de começar fica com intervalo vazio.
        const endsAt = requested < before.startsAt ? before.startsAt : requested;
        if (before.endsAt && endsAt > before.endsAt) {
            throw new BusinessRuleError("Só é possível antecipar o fim da vigência");
        }

        const after = await usersRepository.updateAssignmentEnd(tx, assignmentId, endsAt);
        await audit.record(tx, actor, { action: "ROLE_ENDED", entityType: "RoleAssignment", entityId: assignmentId, before, after });
    });
    return getUser(userId, now);
}
