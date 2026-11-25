// ============================================================
// Tipagens estritas de Autenticação, Usuários e Vigências
// ============================================================

/** Perfis de acesso do sistema */
export type Role = 'PROFESSOR' | 'COUNCIL_MEMBER' | 'HEAD' | 'FINANCIAL_ADMIN';

export type Permission =
  | 'requests:create'
  | 'requests:readAll'
  | 'requests:requestComplement'
  | 'requests:cancelAny'
  | 'votings:open'
  | 'votings:vote'
  | 'votings:tieBreak'
  | 'votings:comment'
  | 'budget:manage'
  | 'budget:read'
  | 'limits:manage'
  | 'categories:manage'
  | 'payments:record'
  | 'users:manage'
  | 'dashboard:read'
  | 'reports:read'
  | 'audit:read';

/** Labels legíveis para cada perfil */
export const ROLE_LABELS: Record<Role, string> = {
  PROFESSOR: 'Docente',
  COUNCIL_MEMBER: 'Conselho',
  HEAD: 'Chefia',
  FINANCIAL_ADMIN: 'Administrador Financeiro',
};

/** Vigência de um perfil de usuário no backend (startsAt / endsAt) */
export interface ProfileTenure {
  id: string;
  role: Role;
  startsAt: string; // ISO 8601
  endsAt: string | null;
}

/** Atribuição de perfil retornada pela API de usuários (`/api/users`) */
export interface RoleAssignment {
  id: number;
  role: Role;
  startsAt: string; // ISO 8601
  endsAt: string | null;
  current: boolean;
}

/** Usuário do sistema (`GET /api/users`) */
export interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  invitePending?: boolean;
  roles: Role[];
  roleAssignments: RoleAssignment[];
  createdAt: string;
}

/** Dados de sessão do usuário autenticado via cookie httpOnly (GET /api/auth/me) */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  activeRoles: Role[];
  activeRole: Role | null;
  availableRoles: Role[];
  permissions: Permission[];
}

/** Resposta efetiva de GET /api/auth/me. */
export interface AuthMeResponse {
  id: number | string;
  name: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
}

/** Resposta da API de sessão atual */
export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

/** Payload de autenticação institucional */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Resposta da API de login (sessão emitida em cookie httpOnly no servidor) */
export interface LoginResponse {
  user: AuthUser;
}

/** Payload de convite de usuário (`POST /api/users`) */
export interface InviteUserPayload {
  email: string;
  name: string;
  roles: Role[];
}

/** Payload de atribuição de novo perfil a usuário existente (`POST /api/users/:id/roles`) */
export interface AssignProfilePayload {
  userId: number;
  role: Role;
  startsAt?: string;
  endsAt?: string;
}

/** Payload de alteração de status ativo/inativo do usuário (`PATCH /api/users/:id`) */
export interface UpdateUserStatusPayload {
  userId: number;
  active: boolean;
}
