import { apiClient } from '@/lib/api-client';
import { resolvePrimaryRole } from '@/lib/auth-rules';
import type {
  AuthMeResponse,
  AuthSessionResponse,
  AuthUser,
  LoginPayload,
  LoginResponse,
  UpdateAvatarPayload,
} from '@/types';

export {
  fetchRequests,
  createRequest,
  updateRequest,
  cancelRequest,
} from '@/features/requests/api';

export {
  fetchUsers,
  inviteUser,
  assignUserProfile,
  updateUserStatus,
  endProfileTenure,
} from '@/features/users/api';

function normalizeAuthUser(response: AuthMeResponse): AuthUser {
  const now = new Date().toISOString();
  const roles = response.roles;
  return {
    id: String(response.id),
    name: response.name,
    email: response.email,
    active: true,
    profiles: roles.map((role, index) => ({
      id: `session-${index}-${role}`,
      role,
      startsAt: now,
      endsAt: null,
    })),
    activeRoles: roles,
    availableRoles: roles,
    activeRole: resolvePrimaryRole(roles),
    permissions: response.permissions,
  };
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  const isOnLoginPage =
    typeof window !== 'undefined' && window.location.pathname === '/login';

  const response = await apiClient.get<AuthMeResponse>('/api/auth/me', {
    skipErrorToast: isOnLoginPage,
    skipAuthRedirect: isOnLoginPage,
  });
  return { authenticated: true, user: normalizeAuthUser(response) };
}

export async function loginWithCredentials(
  payload: LoginPayload,
): Promise<LoginResponse> {
  await apiClient.post<void>('/api/auth/login', payload, {
    skipAuthRedirect: true,
  });
  const session = await fetchCurrentSession();
  return { user: session.user! };
}

export function logoutSession(): Promise<void> {
  return apiClient.post<void>('/api/auth/logout', undefined, {
    skipAuthRedirect: true,
    skipErrorToast: true,
  });
}

export function updateMyAvatar(
  payload: UpdateAvatarPayload,
): Promise<{ user: AuthUser }> {
  return apiClient.patch<{ user: AuthUser }>('/api/auth/me/avatar', payload);
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiClient.post<void>('/api/auth/forgot-password', { email }).then(() => ({
    message: 'Se o e-mail estiver cadastrado, as instruções foram enviadas.',
  }));
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiClient.post<void>('/api/auth/reset-password', {
    token,
    password: newPassword,
  }).then(() => ({ message: 'Senha redefinida com sucesso.' }));
}
