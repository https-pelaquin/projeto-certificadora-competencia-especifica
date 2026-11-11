import { apiClient } from '@/lib/api-client';
import type {
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

export function fetchCurrentSession(): Promise<AuthSessionResponse> {
  const isOnLoginPage =
    typeof window !== 'undefined' && window.location.pathname === '/login';

  return apiClient.get<AuthSessionResponse>('/api/auth/me', {
    skipErrorToast: isOnLoginPage,
    skipAuthRedirect: isOnLoginPage,
  });
}

export function loginWithCredentials(
  payload: LoginPayload,
): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/api/auth/login', payload, {
    skipAuthRedirect: true,
  });
}

export function logoutSession(): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/api/auth/logout', undefined, {
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
  return apiClient.post<{ message: string }>('/api/auth/forgot-password', {
    email,
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/api/auth/reset-password', {
    token,
    newPassword,
  });
}
