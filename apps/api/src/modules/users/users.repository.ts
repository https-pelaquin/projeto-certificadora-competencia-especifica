import type { Prisma, Role } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export function currentRolesWhere(now: Date): Prisma.RoleAssignmentWhereInput {
    return { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

export function findById(db: Db, id: number) {
    return db.user.findUnique({ where: { id } });
}

export function findByEmail(db: Db, email: string) {
    return db.user.findUnique({ where: { email } });
}

export function findWithCurrentRoles(db: Db, id: number, now: Date) {
    return db.user.findUnique({
        where: { id },
        include: { roleAssignments: { where: currentRolesWhere(now), select: { role: true } } },
    });
}

export function update(db: Db, id: number, data: Prisma.UserUpdateInput) {
    return db.user.update({ where: { id }, data });
}

export function findActiveWithRoleAt(db: Db, role: Role, now: Date) {
    return db.user.findMany({
        where: { active: true, roleAssignments: { some: { role, ...currentRolesWhere(now) } } },
        orderBy: { id: "asc" },
    });
}

const userWithAssignments = {
    roleAssignments: { orderBy: { startsAt: "asc" } },
} satisfies Prisma.UserInclude;

export function list(db: Db) {
    return db.user.findMany({ include: userWithAssignments, orderBy: { name: "asc" } });
}

export function findWithAssignments(db: Db, id: number) {
    return db.user.findUnique({ where: { id }, include: userWithAssignments });
}

export function create(db: Db, data: { name: string; email: string }) {
    return db.user.create({ data });
}

export function findAssignment(db: Db, id: number) {
    return db.roleAssignment.findUnique({ where: { id } });
}

export function createAssignment(db: Db, data: { userId: number; role: Role; startsAt: Date; endsAt: Date | null; assignedById: number | null }) {
    return db.roleAssignment.create({ data });
}

export function updateAssignmentEnd(db: Db, id: number, endsAt: Date) {
    return db.roleAssignment.update({ where: { id }, data: { endsAt } });
}

// Intervalos [startsAt, endsAt) que se sobrepõem a [startsAt, endsAt) informado.
export function findOverlapping(db: Db, data: { role: Role; startsAt: Date; endsAt: Date | null; userId?: number }) {
    return db.roleAssignment.findFirst({
        where: {
            role: data.role,
            ...(data.userId !== undefined && { userId: data.userId }),
            ...(data.endsAt && { startsAt: { lt: data.endsAt } }),
            OR: [{ endsAt: null }, { endsAt: { gt: data.startsAt } }],
        },
    });
}
