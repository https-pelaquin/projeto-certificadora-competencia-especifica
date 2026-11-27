import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileQuestion,
  Landmark,
  MessageSquareMore,
  ReceiptText,
  UserRound,
  Vote,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, StatusBadge } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CancelRequestDialog,
  RequestComplementDialog,
  useOperationalRequest,
} from '@/features/operational-requests';
import { PaymentDialog, useProvisionRequest } from '@/features/finance';
import { OpenVotingDialog } from '@/features/votings/components';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime } from '@/lib/utils';
import { REQUEST_STATUS_LABELS, type RequestStatus } from '@/types/request';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatMoney = (value: string | null) =>
  value === null ? 'Não registrado' : moneyFormatter.format(Number(value));

const TERMINAL_STATUSES = new Set<RequestStatus>(['PAID', 'REJECTED', 'CANCELED']);

const ACTION_LABELS: Record<string, string> = {
  REQUEST_CREATED: 'Solicitação criada',
  REQUEST_UPDATED: 'Solicitação atualizada',
  REQUEST_STATUS_CHANGED: 'Status da solicitação alterado',
  COMPLEMENT_REQUESTED: 'Complementação solicitada',
  VOTING_OPENED: 'Votação aberta',
  VOTE_CAST: 'Voto registrado',
  VOTING_CLOSED: 'Votação encerrada',
  VOTING_TIED: 'Votação empatada',
  TIE_BREAK_CAST: 'Voto de desempate registrado',
  VOTING_CANCELED: 'Votação cancelada',
  VOTING_COMMENT_ADDED: 'Comentário adicionado à votação',
  PAYMENT_RECORDED: 'Pagamento registrado',
};

const actionLabel = (action: string) => ACTION_LABELS[action] ?? 'Ação registrada';

function TimelineStatus({ status }: { status: RequestStatus | null }) {
  if (!status) return <span className="text-slate-400">Sem status</span>;
  return <span>{REQUEST_STATUS_LABELS[status] ?? status}</span>;
}

export function RequestDetailPage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const id = idParam && /^\d+$/.test(idParam) && Number(idParam) > 0 ? Number(idParam) : null;
  const requestQuery = useOperationalRequest(id);
  const request = requestQuery.data;
  const provisionMutation = useProvisionRequest();
  const [complementOpen, setComplementOpen] = useState(false);
  const [votingOpen, setVotingOpen] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (id === null) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900">Solicitação inválida</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/solicitacoes')}>Voltar às solicitações</Button>
      </div>
    );
  }

  if (requestQuery.isLoading) {
    return (
      <div className="space-y-5" aria-label="Carregando solicitação">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-xl bg-slate-100 lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900">Não foi possível carregar a solicitação</h1>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => navigate('/solicitacoes')}>Voltar</Button>
          <Button onClick={() => requestQuery.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(user && String(user.id) === String(request.requester.id));
  const canRequestComplement =
    hasPermission('requests:requestComplement') &&
    (request.status === 'AWAITING_VOTING' || request.status === 'IN_VOTING');
  const canOpenVoting = hasPermission('votings:open') && request.status === 'AWAITING_VOTING';
  const canProvision = hasPermission('budget:manage') && request.status === 'AWAITING_BALANCE';
  const canPay = hasPermission('payments:record') && request.status === 'PROVISIONED';
  const hasCancelAny = hasPermission('requests:cancelAny');
  const canCancel = !TERMINAL_STATUSES.has(request.status) && (isOwner || hasCancelAny);
  const requiresCancelJustification = hasCancelAny && !isOwner;
  const hasActions = canRequestComplement || canOpenVoting || canProvision || canPay || canCancel;

  return (
    <div className="space-y-5" data-testid="request-detail-page">
      <Button variant="ghost" className="-ml-2 text-slate-600" onClick={() => navigate('/solicitacoes')}>
        <ArrowLeft /> Voltar às solicitações
      </Button>

      <header className="overflow-hidden rounded-2xl bg-[#123E34] text-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Detalhe operacional</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Solicitação #{request.id}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/85">{request.description}</p>
          </div>
          <StatusBadge status={request.status as RequestStatus} className="w-fit shrink-0 bg-white" />
        </div>
        <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-3">
          <div className="px-5 py-3 sm:px-6"><span className="block text-[10px] uppercase tracking-wider text-emerald-200">Solicitante</span><strong className="text-sm">{request.requester.name}</strong></div>
          <div className="border-white/10 px-5 py-3 sm:border-l sm:px-6"><span className="block text-[10px] uppercase tracking-wider text-emerald-200">Categoria</span><strong className="text-sm">{request.category.name}</strong></div>
          <div className="border-white/10 px-5 py-3 sm:border-l sm:px-6"><span className="block text-[10px] uppercase tracking-wider text-emerald-200">Criada em</span><strong className="text-sm">{formatDateTime(request.createdAt)}</strong></div>
        </div>
      </header>

      {hasActions && (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardContent className="flex flex-wrap gap-2">
            {canRequestComplement && <Button variant="outline" onClick={() => setComplementOpen(true)}><MessageSquareMore /> Solicitar complemento</Button>}
            {canOpenVoting && <Button onClick={() => setVotingOpen(true)} className="bg-[#164E3F] text-white hover:bg-[#0F382C]"><Vote /> Abrir votação</Button>}
            {canProvision && <Button onClick={() => setProvisionOpen(true)} className="bg-[#164E3F] text-white hover:bg-[#0F382C]"><WalletCards /> Provisionar</Button>}
            {canPay && <Button onClick={() => setPaymentOpen(true)} className="bg-[#164E3F] text-white hover:bg-[#0F382C]"><CircleDollarSign /> Registrar pagamento</Button>}
            {canCancel && <Button variant="destructive" onClick={() => setCancelOpen(true)}><XCircle /> Cancelar solicitação</Button>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <main className="space-y-5 lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-emerald-700" /> Valores</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Solicitado</p><strong className="mt-1 block text-lg text-slate-900">{formatMoney(request.amounts.requested)}</strong></div>
              <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs text-amber-700">Provisionado</p><strong className="mt-1 block text-lg text-amber-900">{formatMoney(request.amounts.provisioned)}</strong></div>
              <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Pago</p><strong className="mt-1 block text-lg text-emerald-900">{formatMoney(request.amounts.paid)}</strong></div>
              <p className="text-xs text-slate-400 sm:col-span-3">Valor original da solicitação: {formatMoney(request.amount)}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-emerald-700" /> Linha do tempo</CardTitle></CardHeader>
            <CardContent>
              {request.timeline.length ? (
                <ol className="relative ml-2 border-l border-slate-200">
                  {request.timeline.map((event, index) => (
                    <li key={`${event.at}-${event.action}-${index}`} className="relative pb-6 pl-6 last:pb-0">
                      <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 ring-1 ring-emerald-200" />
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <strong className="text-sm text-slate-900">{actionLabel(event.action)}</strong>
                        <time className="shrink-0 text-xs text-slate-400">{formatDateTime(event.at)}</time>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{event.actor?.name ?? 'Sistema'}</p>
                      {(event.fromStatus || event.toStatus) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <TimelineStatus status={event.fromStatus} /><span aria-hidden>→</span><TimelineStatus status={event.toStatus} />
                        </div>
                      )}
                      {event.justification && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{event.justification}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="py-5 text-center text-sm text-slate-500">Nenhum evento registrado.</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><MessageSquareMore className="h-5 w-5 text-emerald-700" /> Complementações solicitadas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {request.complementRequests.length ? request.complementRequests.map((complement) => (
                <article key={complement.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <strong className="text-sm text-slate-800">{complement.requestedBy.name}</strong>
                    <time className="text-xs text-slate-400">{formatDateTime(complement.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{complement.message}</p>
                </article>
              )) : <p className="py-5 text-center text-sm text-slate-500">Nenhuma complementação solicitada.</p>}
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-5">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader><CardTitle className="text-base">Dados da solicitação</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-slate-400" /><div><p className="text-xs text-slate-500">Solicitante</p><strong>{request.requester.name}</strong><p className="text-xs text-slate-400">ID {request.requester.id}</p></div></div>
              <div className="flex gap-3"><ReceiptText className="mt-0.5 h-4 w-4 text-slate-400" /><div><p className="text-xs text-slate-500">Categoria</p><strong>{request.category.name}</strong><p className="text-xs text-slate-400">ID {request.category.id}</p></div></div>
              <div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" /><div><p className="text-xs text-slate-500">Última atualização</p><strong>{formatDateTime(request.updatedAt)}</strong></div></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4" /> Enquadramento financeiro</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-xs text-slate-500">Orçamento</p>{request.budget ? <p className="font-semibold">Exercício {request.budget.year} <span className="font-normal text-slate-400">(ID {request.budget.id})</span></p> : <p className="text-slate-400">Não vinculado</p>}</div>
              <div><p className="text-xs text-slate-500">Limite de aprovação</p>{request.approvalLimit ? <><p className="font-semibold">{formatMoney(request.approvalLimit.amount)}</p><p className="text-xs text-slate-400">Período de {request.approvalLimit.periodMonths} meses · ID {request.approvalLimit.id}</p></> : <p className="text-slate-400">Não vinculado</p>}</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4" /> Pagamento</CardTitle></CardHeader>
            <CardContent>
              {request.payment ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Valor pago</span><strong className="text-emerald-700">{formatMoney(request.payment.paidAmount)}</strong></div>
                  <div><p className="text-xs text-slate-500">Data</p><p className="font-medium">{formatDateTime(request.payment.paidAt)}</p></div>
                  <div><p className="text-xs text-slate-500">Justificativa</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{request.payment.justification ?? 'Não informada'}</p></div>
                  <Badge variant="outline">Pagamento #{request.payment.id}</Badge>
                </div>
              ) : (
                <div className="py-4 text-center"><FileQuestion className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm text-slate-500">Pagamento ainda não registrado.</p></div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {canRequestComplement && <RequestComplementDialog requestId={request.id} open={complementOpen} onOpenChange={setComplementOpen} />}
      {canOpenVoting && <OpenVotingDialog requestId={request.id} open={votingOpen} onOpenChange={setVotingOpen} />}
      {canPay && <PaymentDialog requestId={request.id} provisionedAmount={request.amounts.provisioned ?? request.amount} requestDescription={request.description} open={paymentOpen} onOpenChange={setPaymentOpen} />}
      {canCancel && <CancelRequestDialog requestId={request.id} justificationRequired={requiresCancelJustification} open={cancelOpen} onOpenChange={setCancelOpen} />}
      <ConfirmDialog
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        title="Provisionar esta solicitação?"
        description={`O valor de ${formatMoney(request.amounts.requested)} será reservado no orçamento vinculado.`}
        confirmLabel="Confirmar provisionamento"
        onConfirm={() => provisionMutation.mutate(request.id, { onSuccess: () => setProvisionOpen(false) })}
        isLoading={provisionMutation.isPending}
      />
    </div>
  );
}
