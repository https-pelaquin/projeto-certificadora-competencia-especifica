import { useQuery } from '@tanstack/react-query';
import type { VotingStatus } from '@/types/voting';
import { fetchVoting, fetchVotingComments, fetchVotings } from './votings-api';

export const votingsQueryKeys = {
  all: ['votings'] as const,
  lists: () => [...votingsQueryKeys.all, 'list'] as const,
  list: (status?: VotingStatus) => [...votingsQueryKeys.lists(), status ?? 'ALL'] as const,
  details: () => [...votingsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...votingsQueryKeys.details(), id] as const,
  comments: (id: number) => [...votingsQueryKeys.detail(id), 'comments'] as const,
};

export function useVotings(status?: VotingStatus) {
  return useQuery({
    queryKey: votingsQueryKeys.list(status),
    queryFn: () => fetchVotings(status),
  });
}

export function useVoting(id: number | null) {
  return useQuery({
    queryKey: votingsQueryKeys.detail(id ?? 0),
    queryFn: () => fetchVoting(id!),
    enabled: id !== null,
  });
}

export function useVotingComments(id: number | null, enabled = true) {
  return useQuery({
    queryKey: votingsQueryKeys.comments(id ?? 0),
    queryFn: () => fetchVotingComments(id!),
    enabled: id !== null && enabled,
  });
}
