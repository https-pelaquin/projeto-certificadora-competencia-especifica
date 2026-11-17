import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REQUEST_STATUS_LABELS, type RequestStatus } from '@/types';

// Especificação semântica:
// - Verde: Aprovado / Pago (PROVISIONED / PAID)
// - Amarelo/Âmbar: Em Votação / Provisionado / Aguardando (AWAITING_VOTING, IN_VOTING, AWAITING_COMPLEMENT, AWAITING_BALANCE)
// - Azul: Utilizado
// - Vermelho: Rejeitado / Cancelado (REJECTED, CANCELED)
const statusStyles: Record<RequestStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
  AWAITING_VOTING: 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-50',
  IN_VOTING: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100',
  AWAITING_COMPLEMENT: 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-50',
  AWAITING_BALANCE: 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-50',
  PROVISIONED: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-semibold',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-400 hover:bg-emerald-100 font-semibold',
  REJECTED: 'bg-red-50 text-red-700 border-red-300 hover:bg-red-50',
  CANCELED: 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-50',
};

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[11px] px-2.5 py-0.5 rounded-full border shadow-2xs transition-colors tracking-wide',
        statusStyles[status] || 'bg-slate-100 text-slate-700',
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5 opacity-80" 
        style={{
          backgroundColor:
            status === 'PAID' || status === 'PROVISIONED'
              ? '#16a34a'
              : status === 'REJECTED' || status === 'CANCELED'
              ? '#dc2626'
              : '#d97706'
        }}
      />
      {REQUEST_STATUS_LABELS[status] || status}
    </Badge>
  );
}

