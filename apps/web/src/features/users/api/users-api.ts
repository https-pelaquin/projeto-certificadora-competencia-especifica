import { apiClient } from '@/lib/api-client';
import type {
  AssignProfilePayload,
  InviteUserPayload,
  PaginatedResponse,
  UpdateUserStatusPayload,
  User,
} from '@/types';

export function fetchUsers(): Promise<PaginatedResponse<User>> {
  return apiClient.get<PaginatedResponse<User>>('/api/users');
}

export function inviteUser(payload: InviteUserPayload): Promise<User> {
  return apiClient.post<User>('/api/users/invite', payload);
}

export function assignUserProfile({
  userId,
  ...body
}: AssignProfilePayload): Promise<User> {
  return apiClient.post<User>(
    `/api/users/${encodeURIComponent(userId)}/profiles`,
    body,
  );
}

export function updateUserStatus({
  userId,
  active,
}: UpdateUserStatusPayload): Promise<User> {
  return apiClient.patch<User>(
    `/api/users/${encodeURIComponent(userId)}/status`,
    { active },
  );
}

export function endProfileTenure(
  userId: string,
  profileId: string,
): Promise<User> {
  return apiClient.patch<User>(
    `/api/users/${encodeURIComponent(userId)}/profiles/${encodeURIComponent(profileId)}/end`,
  );
}

