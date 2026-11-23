import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleSlash2,
  Loader2,
  MessageSquare,
  Scale,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  useAddVotingComment,
  useCastTieBreak,
  useCastVote,
  useVoting,
  useVotingComments,
} from '@/features/votings/api';
import {
  VotingResultBadge,
  VotingStatusBadge,
} from '@/features/votings/components';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';
import {
  votingCommentSchema,
  type VotingCommentFormValues,
} from '@/schemas/voting.schema';
import {
  VOTE_CHOICE_LABELS,
  type TieBreakChoice,
  type VoteChoice,
} from '@/types/voting';

const formatMoney = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

type PendingDecision =
  | { kind: 'vote'; choice: VoteChoice }
  | { kind: 'tieBreak'; choice: TieBreakChoice };

const decisionText = (decision: PendingDecision | null) => {
  if (!decision) return '';
  return decision.kind === 'tieBreak'
    ? `${decision.choice === 'APPROVE' ? 'aprovar' : 'rejeitar'} a solicitação no desempate`
    : `votar em "${VOTE_CHOICE_LABELS[decision.choice]}"`;
};

export function VotingDetailPage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const id = idParam && /^\d+$/.test(idParam) && Number(idParam) > 0 ? Number(idParam) : null;
  const votingQuery = useVoting(id);
  const voting = votingQuery.data;
  const canSeeCouncilData = voting?.members !== undefined;
  const canComment = hasPermission('votings:comment') && canSeeCouncilData;
  const commentsQuery = useVotingComments(id, canComment);
  const voteMutation = useCastVote();
  const tieBreakMutation = useCastTieBreak();
  const commentMutation = useAddVotingComment();
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<VotingCommentFormValues>({
    resolver: zodResolver(votingCommentSchema),
    defaultValues: { body: '' },
  });
  const commentLength = watch('body').length;
  const commentsOpen = voting?.status === 'OPEN' || voting?.status === 'AWAITING_TIE_BREAK';

  const confirmDecision = () => {
    if (!pendingDecision || id === null) return;
    if (pendingDecision.kind === 'vote') {
      voteMutation.mutate(
        { id, payload: { choice: pendingDecision.choice } },
        {
          onSuccess: () => {
            toast.success('Seu voto foi registrado.');
            setPendingDecision(null);
          },
        },
      );
      return;
    }
    tieBreakMutation.mutate(
      { id, payload: { choice: pendingDecision.choice } },
      {
        onSuccess: () => {
          toast.success('O voto de desempate foi registrado e a votação encerrada.');
          setPendingDecision(null);
        },
      },
    );
  };

  const submitComment = handleSubmit((values) => {
    if (id === null) return;
    commentMutation.mutate(
      { id, payload: { body: values.body.trim() } },
      {
        onSuccess: () => {
          toast.success('Comentário publicado.');
          reset();
        },
      },
    );
  });

  if (id === null) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center text-center" data-testid="voting-invalid-id">
        <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900">Votação inválida</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/deliberacoes')}>Voltar às votações</Button>
      </div>
    );
  }

  if (votingQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="voting-detail-loading">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-xl bg-slate-100 lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (votingQuery.isError || !voting) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center text-center" data-testid="voting-detail-error">
        <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900">Não foi possível carregar a votação</h1>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => navigate('/deliberacoes')}>Voltar</Button>
          <Button onClick={() => votingQuery.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const mutationPending = voteMutation.isPending || tieBreakMutation.isPending;
  const mayVote = Boolean(voting.canVote && hasPermission('votings:vote'));
  const mayTieBreak = voting.status === 'AWAITING_TIE_BREAK' && hasPermission('votings:tieBreak');

  return (
    <div className="space-y-5" data-testid="voting-detail-page">
      <Button
        variant="ghost"
        className="-ml-2 text-slate-600"
        onClick={() => navigate('/deliberacoes')}
        data-testid="btn-back-votings"
      >
        <ArrowLeft /> Voltar às votações
      </Button>

      <header className="flex flex-col gap-4 rounded-2xl bg-[#123E34] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Deliberação do conselho</p>
          <h1 className="mt-1 text-2xl font-extrabold">Votação #{voting.id}</h1>
          <p className="mt-1 text-sm text-emerald-100/80">Solicitação #{voting.request.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VotingStatusBadge status={voting.status} />
          {voting.result && <VotingResultBadge result={voting.result} />}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Resumo da solicitação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Descrição</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800" data-testid="voting-request-description">
                  {voting.request.description}
                </p>
              </div>
              <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Valor solicitado</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900">{formatMoney(voting.request.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Abertura</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(voting.openedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Prazo final</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                    <CalendarClock className="h-4 w-4 text-amber-600" /> {formatDateTime(voting.deadline)}
                  </p>
                </div>
              </div>
              {voting.closedAt && (
                <p className="text-xs text-slate-500">Encerrada em {formatDateTime(voting.closedAt)}</p>
              )}
            </CardContent>
          </Card>

          {mayVote && (
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs" data-testid="voting-actions">
              <CardHeader>
                <CardTitle>Registre seu voto</CardTitle>
                <p className="text-sm text-slate-600">O voto é definitivo e não poderá ser alterado.</p>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-3">
                <Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setPendingDecision({ kind: 'vote', choice: 'APPROVE' })} data-testid="btn-vote-approve">
                  <CheckCircle2 /> Aprovar
                </Button>
                <Button variant="destructive" onClick={() => setPendingDecision({ kind: 'vote', choice: 'REJECT' })} data-testid="btn-vote-reject">
                  <XCircle /> Rejeitar
                </Button>
                <Button variant="outline" onClick={() => setPendingDecision({ kind: 'vote', choice: 'ABSTAIN' })} data-testid="btn-vote-abstain">
                  <CircleSlash2 /> Abster-se
                </Button>
              </CardContent>
            </Card>
          )}

          {mayTieBreak && (
            <Card className="border-amber-300 bg-amber-50 shadow-xs" data-testid="tie-break-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scale className="text-amber-700" /> Desempate da chefia</CardTitle>
                <p className="text-sm text-slate-600">A votação terminou empatada. Seu voto definirá o resultado.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                <Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setPendingDecision({ kind: 'tieBreak', choice: 'APPROVE' })} data-testid="btn-tie-break-approve">
                  Aprovar solicitação
                </Button>
                <Button variant="destructive" onClick={() => setPendingDecision({ kind: 'tieBreak', choice: 'REJECT' })} data-testid="btn-tie-break-reject">
                  Rejeitar solicitação
                </Button>
              </CardContent>
            </Card>
          )}

          {canComment && (
            <Card className="border-slate-200 bg-white shadow-xs" data-testid="voting-comments">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comentários do conselho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {commentsQuery.isLoading ? (
                  <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ) : commentsQuery.isError ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar os comentários.</p>
                ) : commentsQuery.data?.length ? (
                  <div className="space-y-3" data-testid="comments-list">
                    {commentsQuery.data.map((comment) => (
                      <article key={comment.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-xs text-slate-800">{comment.author.name}</strong>
                          <time className="text-[11px] text-slate-400">{formatDateTime(comment.createdAt)}</time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-slate-500">Nenhum comentário publicado.</p>
                )}

                {commentsOpen && (
                  <form onSubmit={submitComment} className="space-y-2 border-t border-slate-100 pt-4" data-testid="comment-form">
                    <Textarea
                      placeholder="Compartilhe uma observação com o conselho..."
                      maxLength={2000}
                      rows={4}
                      aria-invalid={Boolean(errors.body)}
                      data-testid="input-voting-comment"
                      {...register('body')}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {errors.body && <p className="text-xs font-medium text-red-600">{errors.body.message}</p>}
                        <p className="text-[11px] text-slate-400">{commentLength}/2000 caracteres</p>
                      </div>
                      <Button type="submit" disabled={commentMutation.isPending} data-testid="btn-submit-comment" className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
                        {commentMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />} Publicar
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          {voting.counts && (
            <Card className="border-slate-200 bg-white shadow-xs" data-testid="voting-counts">
              <CardHeader><CardTitle>Resultado da apuração</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-50 p-3"><strong className="block text-xl text-emerald-700">{voting.counts.approve}</strong><span className="text-[11px] text-emerald-700">Aprovar</span></div>
                <div className="rounded-xl bg-rose-50 p-3"><strong className="block text-xl text-rose-700">{voting.counts.reject}</strong><span className="text-[11px] text-rose-700">Rejeitar</span></div>
                <div className="rounded-xl bg-slate-100 p-3"><strong className="block text-xl text-slate-700">{voting.counts.abstain}</strong><span className="text-[11px] text-slate-600">Abstenções</span></div>
              </CardContent>
            </Card>
          )}

          {voting.members && (
            <Card className="border-slate-200 bg-white shadow-xs" data-testid="voting-members">
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Conselheiros convocados</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {voting.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{member.name}</p>
                      {member.votedAt && <p className="text-[10px] text-slate-400">{formatDateTime(member.votedAt)}</p>}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {member.vote ? VOTE_CHOICE_LABELS[member.vote] : 'Pendente'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {voting.tieBreak && (
            <Card className="border-amber-200 bg-amber-50 shadow-xs" data-testid="tie-break-result">
              <CardContent>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Desempate</p>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>{voting.tieBreak.head.name}</strong> decidiu por {VOTE_CHOICE_LABELS[voting.tieBreak.choice].toLocaleLowerCase('pt-BR')}.
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(voting.tieBreak.createdAt)}</p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open && !mutationPending) setPendingDecision(null);
        }}
        title="Confirmar decisão?"
        description={`Você está prestes a ${decisionText(pendingDecision)}. Esta ação é definitiva e não poderá ser alterada.`}
        confirmLabel="Confirmar decisão"
        cancelLabel="Revisar"
        variant={pendingDecision?.choice === 'REJECT' ? 'destructive' : 'default'}
        confirmTestId="btn-confirm-voting-decision"
        onConfirm={confirmDecision}
        isLoading={mutationPending}
      />
    </div>
  );
}
