import { apiClient } from '@/lib/api-client';
import type {
  AssignProfilePayload,
  InviteUserPayload,
  UpdateUserStatusPayload,
  User,
} from '@/types';

export function fetchUsers(): Promise<User[]> {
  return apiClient.get<User[]>('/api/users');
}

export function inviteUser(payload: InviteUserPayload): Promise<User> {
  return apiClient.post<User>('/api/users', payload);
}

export function resendUserInvite(userId: number): Promise<void> {
  return apiClient.post<void>(`/api/users/${userId}/invite`, {});
}

export function assignUserProfile({
  userId,
  ...body
}: AssignProfilePayload): Promise<User> {
  return apiClient.post<User>(`/api/users/${userId}/roles`, body);
}

export function updateUserStatus({
  userId,
  active,
}: UpdateUserStatusPayload): Promise<User> {
  return apiClient.patch<User>(`/api/users/${userId}`, { active });
}

export function endProfileTenure(
  userId: number,
  assignmentId: number,
): Promise<User> {
  return apiClient.post<User>(`/api/users/${userId}/roles/${assignmentId}/end`, {});
}

