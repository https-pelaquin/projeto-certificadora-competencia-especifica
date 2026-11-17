import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import {
  assignUserProfile,
  endProfileTenure,
  inviteUser,
  updateUserStatus,
} from './users-api';
import { usersQueryKeys } from './use-users';
import type {
  AssignProfilePayload,
  InviteUserPayload,
  UpdateUserStatusPayload,
} from '@/types';

const AUTH_SESSION_QUERY_KEY = ['auth', 'me'] as const;

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      toast.success('Usuário convidado com sucesso.');
    },
  });
}

export function useAssignProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AssignProfilePayload) => assignUserProfile(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
      ]);
      toast.success('Novo perfil atribuído ao usuário.');
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateUserStatusPayload) => updateUserStatus(payload),
    onSuccess: async (updatedUser) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
      ]);
      toast.success(
        updatedUser.active
          ? 'Usuário reativado com sucesso.'
          : 'Usuário desativado com sucesso.',
      );
    },
  });
}

export function useEndProfileTenure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      profileId,
    }: {
      userId: string;
      profileId: string;
    }) => endProfileTenure(userId, profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
      ]);
      toast.success('Vigência do perfil encerrada.');
    },
  });
}

