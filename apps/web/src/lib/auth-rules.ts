import type { AuthUser, ProfileTenure, Role } from '@/types';

const ROLE_PRIORITY: Role[] = [
  'HEAD',
  'COUNCIL_MEMBER',
  'FINANCIAL_ADMIN',
  'PROFESSOR',
];

/**
 * Verifica se a vigência de um perfil está ativa na data de referência.
 */
export function isTenureActive(
  tenure: ProfileTenure,
  referenceDate: Date = new Date(),
): boolean {
  const refTime = referenceDate.getTime();
  const startTime = Date.parse(tenure.startsAt);
  if (Number.isNaN(startTime) || startTime > refTime) {
    return false;
  }

  if (tenure.endsAt === null) {
    return true;
  }

  const endTime = Date.parse(tenure.endsAt);
  return !Number.isNaN(endTime) && endTime >= refTime;
}

/**
 * Extrai a lista única de perfis vigentes do usuário.
 */
export function getActiveRoles(
  profiles: ProfileTenure[],
  active = true,
  referenceDate: Date = new Date(),
): Role[] {
  if (!active) return [];

  const activeSet = new Set<Role>();
  for (const tenure of profiles) {
    if (isTenureActive(tenure, referenceDate)) {
      activeSet.add(tenure.role);
    }
  }
  return Array.from(activeSet);
}

/**
 * Verifica se o usuário autenticado está ativo e possui determinado perfil vigente.
 */
export function hasActiveRole(
  user: AuthUser | null | undefined,
  role: Role,
  referenceDate: Date = new Date(),
): boolean {
  if (!user || !user.active) return false;
  return user.profiles.some(
    (tenure) => tenure.role === role && isTenureActive(tenure, referenceDate),
  );
}

/**
 * Verifica se o usuário autenticado possui pelo menos um dos perfis permitidos vigente.
 */
export function hasAnyActiveRole(
  user: AuthUser | null | undefined,
  allowedRoles: Role[],
  referenceDate: Date = new Date(),
): boolean {
  return allowedRoles.some((role) => hasActiveRole(user, role, referenceDate));
}

/**
 * Determina o perfil principal para exibição com base na precedência institucional.
 */
export function resolvePrimaryRole(activeRoles: Role[]): Role | null {
  for (const role of ROLE_PRIORITY) {
    if (activeRoles.includes(role)) {
      return role;
    }
  }
  return activeRoles[0] ?? null;
}
