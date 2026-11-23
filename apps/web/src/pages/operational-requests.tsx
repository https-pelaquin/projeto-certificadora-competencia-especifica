import { useMemo, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, StatusBadge, TableSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOperationalRequests } from '@/features/operational-requests/api';
import { formatDate } from '@/lib/utils';
import { REQUEST_STATUS_LABELS, type RequestStatus } from '@/types/request';

const OPERATIONAL_STATUSES: RequestStatus[] = ['AWAITING_VOTING', 'IN_VOTING', 'AWAITING_BALANCE', 'PROVISIONED', 'PAID', 'REJECTED', 'CANCELED'];

function formatMoney(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export function OperationalRequestsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RequestStatus>('AWAITING_BALANCE');
  const [search, setSearch] = useState('');
  const query = useOperationalRequests(status);
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return query.data?.items ?? [];
    return (query.data?.items ?? []).filter((item) =>
      item.description.toLocaleLowerCase('pt-BR').includes(term) || item.requester.name.toLocaleLowerCase('pt-BR').includes(term) || item.category.name.toLocaleLowerCase('pt-BR').includes(term) || String(item.id).includes(term),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-6" data-testid="operational-requests-page">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-[#164E3F] p-2.5 text-white"><SlidersHorizontal className="h-5 w-5" /></div>
        <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Operações de solicitações</h1><p className="mt-1 text-sm text-slate-500">Acompanhe deliberações, provisionamentos e pagamentos.</p></div>
      </header>
      <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ID, solicitante, categoria ou descrição..." className="pl-9" /></div>
          <Select value={status} onValueChange={(value) => value && setStatus(value as RequestStatus)}><SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent>{OPERATIONAL_STATUSES.map((value) => <SelectItem key={value} value={value}>{REQUEST_STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select>
        </div>
        {query.isLoading ? <TableSkeleton rows={6} columns={7} /> : query.isError ? (
          <div className="p-10 text-center"><p className="font-semibold text-red-700">Não foi possível carregar as solicitações.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState title="Nenhuma solicitação neste estágio" description="Altere o status ou os termos da busca." /></div>
        ) : (
          <Table><TableHeader><TableRow className="bg-slate-50"><TableHead>ID</TableHead><TableHead>Solicitante</TableHead><TableHead className="hidden md:table-cell">Categoria</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead className="hidden sm:table-cell">Data</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>
            {items.map((item) => <TableRow key={item.id} data-testid={`operational-request-${item.id}`}><TableCell className="font-bold">#{item.id}</TableCell><TableCell className="text-sm">{item.requester.name}</TableCell><TableCell className="hidden text-sm md:table-cell">{item.category.name}</TableCell><TableCell><p className="max-w-72 truncate text-sm">{item.description}</p><div className="mt-1"><StatusBadge status={item.status} /></div></TableCell><TableCell className="whitespace-nowrap font-semibold">{formatMoney(item.amount)}</TableCell><TableCell className="hidden whitespace-nowrap text-xs text-slate-500 sm:table-cell">{formatDate(item.createdAt)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => navigate(`/solicitacoes/${item.id}`)}>Detalhes <ArrowRight /></Button></TableCell></TableRow>)}
          </TableBody></Table>
        )}
      </Card>
    </div>
  );
}
