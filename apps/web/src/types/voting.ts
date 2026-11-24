export type VotingStatus = 'OPEN' | 'AWAITING_TIE_BREAK' | 'CLOSED' | 'CANCELED';

export type VotingResult = 'APPROVED' | 'REJECTED';
export type VoteChoice = 'APPROVE' | 'REJECT' | 'ABSTAIN';
export type TieBreakChoice = Exclude<VoteChoice, 'ABSTAIN'>;

export const VOTING_STATUS_LABELS: Record<VotingStatus, string> = {
  OPEN: 'Aberta',
  AWAITING_TIE_BREAK: 'Aguardando desempate',
  CLOSED: 'Encerrada',
  CANCELED: 'Cancelada',
};

export const VOTING_RESULT_LABELS: Record<VotingResult, string> = {
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
};

export const VOTE_CHOICE_LABELS: Record<VoteChoice, string> = {
  APPROVE: 'Aprovar',
  REJECT: 'Rejeitar',
  ABSTAIN: 'Abster-se',
};

export interface VotingRequestSummary {
  id: number;
  requesterId: number;
  description: string;
  amount: string;
  status?: string;
}

export interface VotingListItem {
  id: number;
  request: VotingRequestSummary;
  status: VotingStatus;
  result: VotingResult | null;
  openedAt: string;
  deadline: string;
  closedAt: string | null;
  convened: boolean;
  myVote: VoteChoice | null;
}

export interface VotingCounts {
  approve: number;
  reject: number;
  abstain: number;
}

export interface VotingMember {
  id: number;
  name: string;
  vote: VoteChoice | null;
  votedAt: string | null;
}

export interface VotingTieBreak {
  head: { id: number; name: string };
  choice: TieBreakChoice;
  createdAt: string;
}

export interface VotingDetail extends Omit<VotingListItem, 'convened' | 'myVote'> {
  counts?: VotingCounts | null;
  members?: VotingMember[];
  tieBreak?: VotingTieBreak | null;
  canVote?: boolean;
}

export interface VotingRecord {
  id: number;
  requestId: number;
  openedById: number;
  openedAt: string;
  deadline: string;
  status: VotingStatus;
  result: VotingResult | null;
  approveCount: number | null;
  rejectCount: number | null;
  abstainCount: number | null;
  closedAt: string | null;
}

export interface VotingVote {
  votingId: number;
  userId: number;
  choice: VoteChoice;
  createdAt: string;
}

export interface VotingComment {
  id: number;
  votingId: number;
  authorId: number;
  body: string;
  createdAt: string;
  author: { id: number; name: string };
}

export interface OpenVotingPayload {
  deadline: string;
}

export interface VotePayload {
  choice: VoteChoice;
}

export interface TieBreakPayload {
  choice: TieBreakChoice;
}

export interface CommentPayload {
  body: string;
}
