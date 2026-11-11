import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatusBadge, TableSkeleton } from '@/components/shared';
import { RequestsOverviewCards } from '@/features/requests/components/requests-overview-cards';
import { useRequests } from '@/features/requests/api';
import { RequestModal } from '@/features/solicitations/request-modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORY_LABELS } from '@/types';

export function OverviewPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: requestsResponse, isLoading, isError } = useRequests();

  const allRequests = useMemo(
    () => requestsResponse?.data ?? [],
    [requestsResponse?.data],
  );
  const recentRequests = useMemo(() => allRequests.slice(0, 4), [allRequests]);

  return (
    <div className="space-y-6" data-testid="overview-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Visão Geral Financeira
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Resumo do limite orçamentário docente, distribuição por rubrica e movimentações recentes
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            data-testid="btn-go-requests"
            onClick={() => navigate('/solicitacoes')}
            className="gap-1.5 h-10 text-xs font-semibold border-slate-200 cursor-pointer"
          >
            Ver Solicitações
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            data-testid="btn-new-request"
            onClick={() => setModalOpen(true)}
            className="bg-[#164E3F] hover:bg-[#0F382C] text-white shadow-sm font-semibold gap-2 h-10 px-4 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Cards de Limite Acumulado e Distribuição */}
      <RequestsOverviewCards
        summary={requestsResponse?.summary}
        requests={allRequests}
        isLoading={isLoading}
        isError={isError}
      />

      {/* Últimas solicitações */}
      <Card
        data-testid="overview-recent-requests"
        className="border-slate-200/80 shadow-2xs bg-white rounded-2xl overflow-hidden"
      >
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Solicitações Recentes
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-400">
              Acompanhamento rápido dos últimos pedidos registrados
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/solicitacoes')}
            className="text-xs text-[#164E3F] hover:text-[#0F382C] hover:bg-emerald-50 gap-1 cursor-pointer"
          >
            Gerenciar todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : recentRequests.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma solicitação cadastrada até o momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {req.description}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {EXPENSE_CATEGORY_LABELS[req.category]} • {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      {formatCurrency(req.amount)}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        request={null}
        isAmountLocked={false}
      />
    </div>
  );
}

