import { useState, type ElementType } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  Plus,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, TableSkeleton } from '@/components/shared';
import { useAuth } from '@/hooks/use-auth';
import {
  AdjustmentDialog,
  ApprovalLimitDialog,
  BudgetDialog,
  useApprovalLimits,
  useBudget,
  useBudgetLedger,
  useBudgets,
} from '@/features/finance';
import type { BudgetBalance, LedgerEntryType } from '@/types/finance';

const ledgerLabels: Record<LedgerEntryType, string> = {
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de saída',
  PROVISION: 'Provisionamento',
  RELEASE: 'Liberação',
  SPEND: 'Pagamento',
};

const outgoingTypes = new Set<LedgerEntryType>(['ADJUSTMENT_OUT', 'PROVISION', 'SPEND']);

function formatMoney(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: ElementType;
  tone: string;
}) {
  return (
    <Card className="border-slate-200/80 bg-white shadow-2xs">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-extrabold tabular-nums text-slate-900">{formatMoney(value)}</p>
        </div>
        <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

export function FinancePage() {
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const { hasPermission } = useAuth();
  const budgetsQuery = useBudgets();
  const selectedBudgetId = selectedBudget ?? budgetsQuery.data?.[0]?.id ?? null;
  const budgetQuery = useBudget(selectedBudgetId);
  const ledgerQuery = useBudgetLedger(selectedBudgetId, page, 10);
  const limitsQuery = useApprovalLimits();

  const balance: BudgetBalance | undefined = budgetQuery.data?.balance;
  const totalPages = Math.max(1, Math.ceil((ledgerQuery.data?.total ?? 0) / 10));

  return (
    <div className="space-y-6" data-testid="finance-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Gestão financeira</h1>
            <Badge className="bg-emerald-100 text-[#164E3F]">Orçamento</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Saldos, movimentações e limites de aprovação por exercício.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('budget:manage') && (
            <>
              <Button variant="outline" onClick={() => setBudgetOpen(true)}><Plus />Novo orçamento</Button>
              <Button disabled={selectedBudgetId === null} onClick={() => setAdjustmentOpen(true)} className="bg-[#164E3F] text-white hover:bg-[#0F382C]"><CircleDollarSign />Ajustar saldo</Button>
            </>
          )}
          {hasPermission('limits:manage') && (
            <Button variant="outline" onClick={() => setLimitOpen(true)}><ShieldCheck />Novo limite</Button>
          )}
        </div>
      </div>

      <Card className="border-slate-200/80 bg-gradient-to-r from-slate-50 to-emerald-50/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Exercício selecionado</p>
            <p className="mt-1 text-sm text-slate-600">Consulte o orçamento e o histórico de lançamentos do ano.</p>
          </div>
          {budgetsQuery.isLoading ? <LoaderCircle className="animate-spin text-[#164E3F]" /> : (
            <Select
              value={selectedBudgetId?.toString() ?? ''}
              onValueChange={(value) => {
                if (!value) return;
                setSelectedBudget(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white font-bold sm:w-44"><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
              <SelectContent>
                {(budgetsQuery.data ?? []).map((budget) => <SelectItem key={budget.id} value={budget.id.toString()}>{budget.year}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {budgetsQuery.isError || budgetQuery.isError ? (
        <EmptyState title="Não foi possível carregar o orçamento" description="Tente atualizar a página. Se o problema persistir, contate o suporte." />
      ) : !budgetsQuery.isLoading && budgetsQuery.data?.length === 0 ? (
        <EmptyState title="Nenhum orçamento cadastrado" description="Ainda não existe orçamento anual disponível para consulta." action={hasPermission('budget:manage') ? <Button onClick={() => setBudgetOpen(true)}><Plus />Criar orçamento</Button> : undefined} />
      ) : balance ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total" value={balance.total} icon={WalletCards} tone="bg-slate-100 text-slate-700" />
          <SummaryCard title="Disponível" value={balance.available} icon={Banknote} tone="bg-emerald-100 text-emerald-700" />
          <SummaryCard title="Provisionado" value={balance.provisioned} icon={Clock3} tone="bg-amber-100 text-amber-700" />
          <SummaryCard title="Utilizado" value={balance.spent} icon={ReceiptText} tone="bg-blue-100 text-blue-700" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2"><ReceiptText className="text-[#164E3F]" />Lançamentos do orçamento</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            {ledgerQuery.isLoading ? <TableSkeleton rows={6} columns={5} /> : ledgerQuery.isError ? (
              <div className="p-8 text-center text-sm text-red-600">Não foi possível carregar os lançamentos.</div>
            ) : !ledgerQuery.data?.items.length ? (
              <div className="p-5"><EmptyState title="Sem movimentações" description="Este orçamento ainda não possui lançamentos." className="py-10" /></div>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Movimento</TableHead><TableHead>Referência</TableHead><TableHead>Responsável</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ledgerQuery.data.items.map((entry) => {
                    const outgoing = outgoingTypes.has(entry.type);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell><div className="flex items-center gap-2">{outgoing ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : <ArrowDownLeft className="h-4 w-4 text-emerald-600" />}<span className="text-xs font-semibold">{ledgerLabels[entry.type]}</span></div></TableCell>
                        <TableCell className="max-w-52 text-xs text-slate-600"><p className="truncate">{entry.justification ?? (entry.requestId ? `Solicitação #${entry.requestId}` : 'Sem justificativa')}</p></TableCell>
                        <TableCell className="text-xs">{entry.createdBy?.name ?? 'Sistema'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(entry.createdAt)}</TableCell>
                        <TableCell className={`text-right text-xs font-bold tabular-nums ${outgoing ? 'text-red-600' : 'text-emerald-700'}`}>{outgoing ? '-' : '+'}{formatMoney(entry.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {(ledgerQuery.data?.total ?? 0) > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || ledgerQuery.isFetching} onClick={() => setPage((current) => current - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={page >= totalPages || ledgerQuery.isFetching} onClick={() => setPage((current) => current + 1)}>Próxima</Button></div>
            </div>
          )}
        </Card>

        <Card className="h-fit border-slate-200/80 bg-white shadow-2xs">
          <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-[#164E3F]" />Histórico de limites</CardTitle></CardHeader>
          <CardContent className="p-4">
            {limitsQuery.isLoading ? <div className="flex justify-center py-8"><LoaderCircle className="animate-spin text-[#164E3F]" /></div> : limitsQuery.isError ? <p className="py-8 text-center text-xs text-red-600">Falha ao carregar limites.</p> : !limitsQuery.data?.length ? <p className="py-8 text-center text-xs text-slate-500">Nenhum limite cadastrado.</p> : (
              <div className="space-y-3">
                {limitsQuery.data.map((limit, index) => (
                  <div key={limit.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2"><p className="font-bold tabular-nums text-slate-900">{formatMoney(limit.amount)}</p>{index === 0 && !limit.validUntil && <Badge className="bg-emerald-100 text-emerald-800">Vigente</Badge>}</div>
                    <p className="mt-1 text-xs text-slate-500">Período: {limit.periodMonths} {limit.periodMonths === 1 ? 'mês' : 'meses'}</p>
                    <p className="mt-2 text-xs text-slate-500">{new Date(limit.validFrom).toLocaleDateString('pt-BR')} até {limit.validUntil ? new Date(limit.validUntil).toLocaleDateString('pt-BR') : 'vigente'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} />
      <AdjustmentDialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen} budgetId={selectedBudgetId} />
      <ApprovalLimitDialog open={limitOpen} onOpenChange={setLimitOpen} />
    </div>
  );
}
