import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  VOTING_RESULT_LABELS,
  VOTING_STATUS_LABELS,
  type VotingResult,
  type VotingStatus,
} from '@/types/voting';

const statusStyles: Record<VotingStatus, string> = {
  OPEN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  AWAITING_TIE_BREAK: 'border-amber-200 bg-amber-50 text-amber-700',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
  CANCELED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function VotingStatusBadge({ status }: { status: VotingStatus }) {
  return (
    <Badge
      variant="outline"
      data-testid={`voting-status-${status}`}
      className={cn('font-semibold', statusStyles[status])}
    >
      {VOTING_STATUS_LABELS[status]}
    </Badge>
  );
}

export function VotingResultBadge({ result }: { result: VotingResult }) {
  return (
    <Badge
      variant="outline"
      data-testid={`voting-result-${result}`}
      className={cn(
        'font-semibold',
        result === 'APPROVED'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      {VOTING_RESULT_LABELS[result]}
    </Badge>
  );
}
