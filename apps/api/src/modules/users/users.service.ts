import type { Role } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";
import * as usersRepository from "./users.repository";

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
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
