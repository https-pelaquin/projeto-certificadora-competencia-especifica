import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarClock, Search, Vote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVotings } from '@/features/votings/api';
import {
  VotingResultBadge,
  VotingStatusBadge,
} from '@/features/votings/components';
import { formatDateTime } from '@/lib/utils';
import {
  VOTE_CHOICE_LABELS,
  VOTING_STATUS_LABELS,
  type VotingStatus,
} from '@/types/voting';

const formatMoney = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

export function VotingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | VotingStatus>('ALL');
  const query = useVotings(status === 'ALL' ? undefined : status);

  const votings = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return query.data ?? [];
    return (query.data ?? []).filter(
      (voting) =>
        voting.request.description.toLocaleLowerCase('pt-BR').includes(normalized) ||
        String(voting.id).includes(normalized) ||
        String(voting.request.id).includes(normalized),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-6" data-testid="votings-page">
      <header>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#164E3F] p-2.5 text-white">
            <Vote className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Deliberações</h1>
            <p className="mt-1 text-sm text-slate-500">Acompanhe e participe das votações do conselho.</p>
          </div>
        </div>
      </header>

      <Card className="gap-0 rounded-2xl border-slate-200 bg-white py-0 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por solicitação, descrição ou ID..."
              className="w-full bg-slate-50 pl-9"
              data-testid="input-search-votings"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus((value ?? 'ALL') as 'ALL' | VotingStatus)}
          >
            <SelectTrigger className="w-full bg-white sm:w-56" data-testid="select-filter-voting-status">
              <SelectValue>
                {(value: string | null) =>
                  !value || value === 'ALL'
                    ? 'Todos os status'
                    : VOTING_STATUS_LABELS[value as VotingStatus]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {(Object.entries(VOTING_STATUS_LABELS) as [VotingStatus, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="grid gap-4 p-4 md:grid-cols-2" data-testid="votings-loading">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center px-6 py-16 text-center" data-testid="votings-error">
            <AlertCircle className="mb-3 h-9 w-9 text-red-500" />
            <p className="font-semibold text-slate-800">Não foi possível carregar as votações</p>
            <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>Tentar novamente</Button>
          </div>
        ) : votings.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhuma votação encontrada"
              description={search || status !== 'ALL' ? 'Ajuste a busca ou o filtro selecionado.' : 'Não há deliberações disponíveis para você.'}
            />
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2" data-testid="votings-list">
            {votings.map((voting) => (
              <article
                key={voting.id}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md"
                data-testid={`voting-card-${voting.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Votação #{voting.id}</p>
                    <p className="mt-1 text-xs text-slate-400">Solicitação #{voting.request.id}</p>
                  </div>
                  <VotingStatusBadge status={voting.status} />
                </div>
                <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium text-slate-800">
                  {voting.request.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <strong className="text-slate-800">{formatMoney(voting.request.amount)}</strong>
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Até {formatDateTime(voting.deadline)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-500">
                    {voting.result ? <VotingResultBadge result={voting.result} /> : voting.myVote ? `Seu voto: ${VOTE_CHOICE_LABELS[voting.myVote]}` : voting.convened ? 'Seu voto está pendente' : 'Acompanhamento'}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/deliberacoes/${voting.id}`)}
                    data-testid={`btn-view-voting-${voting.id}`}
                    className="text-[#164E3F]"
                  >
                    Ver detalhes <ArrowRight />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
