import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_SESSION_QUERY_KEY } from '@/hooks/use-auth';
import { toast } from '@/lib/toast';
import { updateMyAvatar } from '@/services/api';
import { usersQueryKeys } from '@/features/users/api';
import type { AuthSessionResponse, UpdateAvatarPayload } from '@/types';

export function useUpdateAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateAvatarPayload) => updateMyAvatar(payload),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData<AuthSessionResponse>(AUTH_SESSION_QUERY_KEY, {
        authenticated: true,
        user,
      });
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      toast.success(
        user.avatarUrl
          ? 'Foto de perfil atualizada com sucesso.'
          : 'Foto de perfil removida com sucesso.',
      );
    },
  });
}

