import { useMemo } from 'react';
import { AlertCircle, DollarSign, PieChart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CardSkeleton } from '@/components/shared';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FinancialSummary, Request } from '@/types';

interface RequestsOverviewCardsProps {
  summary?: FinancialSummary;
  requests: Request[];
  total?: number;
  isLoading: boolean;
  isError: boolean;
}

const CATEGORY_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-blue-600',
  'bg-amber-600',
  'bg-indigo-600',
];

function computeSummaryFromRequests(
  requests: Request[],
  total?: number,
): FinancialSummary {
  const usedAmount = requests
    .filter((r) => r.status === 'PAID' || r.status === 'PROVISIONED')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  return {
    usedAmount,
    totalRequests: total ?? requests.length,
    approvedRequests: requests.filter(
      (r) => r.status === 'PAID' || r.status === 'PROVISIONED',
    ).length,
    pendingRequests: requests.filter((r) =>
      [
        'AWAITING_VOTING',
        'IN_VOTING',
        'AWAITING_COMPLEMENT',
        'AWAITING_BALANCE',
      ].includes(r.status),
    ).length,
    rejectedRequests: requests.filter(
      (r) => r.status === 'REJECTED' || r.status === 'CANCELED',
    ).length,
  };
}

export function RequestsOverviewCards({
  summary,
  requests,
  total,
  isLoading,
  isError,
}: RequestsOverviewCardsProps) {
  const resolvedSummary = useMemo(
    () => summary ?? computeSummaryFromRequests(requests, total),
    [summary, requests, total],
  );

  const categoryStats = useMemo(() => {
    const grouped = new Map<number, { id: number; name: string; count: number }>();
    requests.forEach((r) => {
      const current = grouped.get(r.category.id);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(r.category.id, {
          id: r.category.id,
          name: r.category.name,
          count: 1,
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [requests]);

  if (isLoading) {
    return <CardSkeleton count={2} />;
  }

  if (isError) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Não foi possível carregar os dados das solicitações.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Card 1: Approval Status & Totals */}
      <Card
        data-testid="summary-card-limit"
        className="lg:col-span-7 border-slate-200/80 shadow-2xs bg-white rounded-2xl"
      >
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#164E3F]">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Status e Limite Acumulado no Período
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-400">
                {resolvedSummary.periodStart && resolvedSummary.periodEnd
                  ? `Janela móvel vigente: ${formatDate(resolvedSummary.periodStart)} até ${formatDate(resolvedSummary.periodEnd)}`
                  : 'Resumo consolidado das solicitações registradas'}
              </CardDescription>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-[#164E3F] border border-emerald-200/60">
            Orçamento UTFPR
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Financial highlight row */}
          <div className="grid grid-cols-3 gap-3 mb-5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Limite Total
              </span>
              <p
                data-testid="summary-limit-total"
                className="text-base sm:text-lg font-bold text-slate-900 mt-0.5"
              >
                {resolvedSummary.accumulatedLimit != null
                  ? formatCurrency(resolvedSummary.accumulatedLimit)
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Utilizado
              </span>
              <p
                data-testid="summary-limit-used"
                className="text-base sm:text-lg font-bold text-amber-700 mt-0.5"
              >
                {formatCurrency(resolvedSummary.usedAmount)}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Saldo Disponível
              </span>
              <p
                data-testid="summary-limit-available"
                className="text-base sm:text-lg font-bold text-[#164E3F] mt-0.5"
              >
                {resolvedSummary.availableAmount != null
                  ? formatCurrency(resolvedSummary.availableAmount)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Status Counters */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-[11px] font-medium text-slate-500">
                Solicitados
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {resolvedSummary.totalRequests}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">
                +100% total
              </span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 transition-colors">
              <span className="text-[11px] font-medium text-emerald-800">
                Aprovados
              </span>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {resolvedSummary.approvedRequests}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">
                Liberados
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/60 hover:bg-amber-50 transition-colors">
              <span className="text-[11px] font-medium text-amber-800">
                Em Análise
              </span>
              <p className="text-xl font-extrabold text-amber-700 mt-0.5">
                {resolvedSummary.pendingRequests}
              </p>
              <span className="text-[10px] text-amber-600 font-medium">
                Em votação
              </span>
            </div>
            <div className="p-2 rounded-xl bg-red-50/60 hover:bg-red-50 transition-colors">
              <span className="text-[11px] font-medium text-red-800">
                Rejeitados
              </span>
              <p className="text-xl font-extrabold text-red-700 mt-0.5">
                {resolvedSummary.rejectedRequests}
              </p>
              <span className="text-[10px] text-red-500 font-medium">
                Indeferidos
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Request Type Distribution */}
      <Card
        data-testid="summary-card-categories"
        className="lg:col-span-5 border-slate-200/80 shadow-2xs bg-white rounded-2xl flex flex-col justify-between"
      >
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#164E3F]">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Distribuição por Categoria
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-400">
                Quantidade de pedidos por rubrica
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3.5">
          {categoryStats.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Nenhuma solicitação registrada para exibir a distribuição.
            </p>
          ) : (
            categoryStats.map((item, idx) => {
              const percent =
                requests.length > 0
                  ? Math.round((item.count / requests.length) * 100)
                  : 0;
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {item.name}
                    </span>
                    <span className="text-slate-500 font-semibold">
                      {item.count} pedidos ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

