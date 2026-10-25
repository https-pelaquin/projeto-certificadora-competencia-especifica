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
