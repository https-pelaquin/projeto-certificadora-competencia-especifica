import { apiClient } from '@/lib/api-client';
import type {
  CommentPayload,
  OpenVotingPayload,
  TieBreakPayload,
  VotePayload,
  VotingComment,
  VotingDetail,
  VotingListItem,
  VotingRecord,
  VotingStatus,
  VotingVote,
} from '@/types/voting';

export function fetchVotings(status?: VotingStatus): Promise<VotingListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient.get<VotingListItem[]>(`/api/votings${query}`);
}

export function fetchVoting(id: number): Promise<VotingDetail> {
  return apiClient.get<VotingDetail>(`/api/votings/${id}`);
}

export function openVoting(requestId: number, payload: OpenVotingPayload): Promise<VotingRecord> {
  return apiClient.post<VotingRecord>(`/api/requests/${requestId}/votings`, payload);
}

export function castVote(id: number, payload: VotePayload): Promise<VotingVote> {
  return apiClient.post<VotingVote>(`/api/votings/${id}/votes`, payload);
}

export function castTieBreak(id: number, payload: TieBreakPayload): Promise<VotingRecord> {
  return apiClient.post<VotingRecord>(`/api/votings/${id}/tie-break`, payload);
}

export function fetchVotingComments(id: number): Promise<VotingComment[]> {
  return apiClient.get<VotingComment[]>(`/api/votings/${id}/comments`);
}

export function addVotingComment(id: number, payload: CommentPayload): Promise<VotingComment> {
  return apiClient.post<VotingComment>(`/api/votings/${id}/comments`, payload);
}
