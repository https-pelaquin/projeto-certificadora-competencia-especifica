import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from './users-api';

export const usersQueryKeys = {
  all: ['users'] as const,
  list: () => [...usersQueryKeys.all, 'list'] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKeys.list(),
    queryFn: fetchUsers,
  });
}

