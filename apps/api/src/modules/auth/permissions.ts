import type { Role } from "../../../generated/prisma/client";

// Rotas checam permissões, nunca perfis. Mudar o que um perfil pode fazer = mudar só este mapa.
export const PERMISSIONS = [
    "requests:create",
    "requests:readAll",
    "requests:requestComplement",
    "requests:cancelAny",
    "votings:open",
    "votings:vote",
    "votings:tieBreak",
    "votings:comment",
    "budget:manage",
    "limits:manage",
    "categories:manage",
    "payments:record",
    "users:manage",
    "dashboard:read",
    "reports:read",
    "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// [VALIDAR] Sem perfil de administrador do sistema: o chefe administra; o responsável financeiro só lê.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    PROFESSOR: ["requests:create"],
    COUNCIL_MEMBER: ["requests:create", "votings:vote", "votings:comment"],
    HEAD: [
        "requests:create",
        "requests:readAll",
        "requests:requestComplement",
        "requests:cancelAny",
        "votings:open",
        "votings:tieBreak",
        "votings:comment",
        "budget:manage",
        "limits:manage",
        "categories:manage",
        "payments:record",
        "users:manage",
        "dashboard:read",
        "reports:read",
        "audit:read",
    ],
    FINANCIAL_ADMIN: ["requests:readAll", "dashboard:read", "reports:read", "audit:read"],
};

export function permissionsFor(roles: Role[]): Set<Permission> {
    return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}
