import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CommentPayload,
  OpenVotingPayload,
  TieBreakPayload,
  VotePayload,
} from '@/types/voting';
import {
  addVotingComment,
  castTieBreak,
  castVote,
  openVoting,
} from './votings-api';

async function invalidateVotingData(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['votings'] }),
    queryClient.invalidateQueries({ queryKey: ['requests'] }),
  ]);
}

export function useOpenVoting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: OpenVotingPayload }) =>
      openVoting(requestId, payload),
    onSuccess: () => invalidateVotingData(queryClient),
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: VotePayload }) => castVote(id, payload),
    onSuccess: () => invalidateVotingData(queryClient),
  });
}

export function useCastTieBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TieBreakPayload }) => castTieBreak(id, payload),
    onSuccess: () => invalidateVotingData(queryClient),
  });
}

export function useAddVotingComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CommentPayload }) =>
      addVotingComment(id, payload),
    onSuccess: () => invalidateVotingData(queryClient),
  });
}
