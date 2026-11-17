// ============================================================
// Tipagens estritas de Autenticação, Usuários e Vigências
// ============================================================

/** Perfis de acesso do sistema */
export type Role = 'PROFESSOR' | 'COUNCIL_MEMBER' | 'HEAD' | 'FINANCIAL_ADMIN';

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

/** Usuário do sistema (soft-disable via active: boolean) */
export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  avatarUrl?: string | null;
  profiles: ProfileTenure[];
  createdAt: string;
  updatedAt: string;
}

/** Dados de sessão do usuário autenticado via cookie httpOnly (GET /api/auth/me) */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  avatarUrl?: string | null;
  profiles: ProfileTenure[];
  activeRoles: Role[];
  activeRole: Role | null;
  availableRoles: Role[];
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

/** Payload de convite de usuário */
export interface InviteUserPayload {
  email: string;
  name: string;
  role: Role;
  startsAt: string;
  endsAt?: string | null;
}

/** Payload de atribuição de novo perfil a usuário existente */
export interface AssignProfilePayload {
  userId: string;
  role: Role;
  startsAt: string;
  endsAt?: string | null;
}

/** Payload de alteração de status ativo/inativo do usuário */
export interface UpdateUserStatusPayload {
  userId: string;
  active: boolean;
}

/** Payload de atualização da foto de perfil do usuário autenticado */
export interface UpdateAvatarPayload {
  avatarUrl: string | null;
}
