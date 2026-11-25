import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye, Search, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/shared';
import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTERS,
  fetchAuditLogs,
  type AuditFilters,
  type AuditLog,
} from '@/features/audit/audit-api';

const ACTION_LABELS: Record<string, string> = {
  USER_SEEDED: 'Usuário inicial cadastrado',
  REQUEST_CREATED: 'Solicitação criada',
  REQUEST_STATUS_CHANGED: 'Situação da solicitação alterada',
  REQUEST_UPDATED: 'Solicitação alterada',
  REQUEST_CANCELED: 'Solicitação cancelada',
  PAYMENT_RECORDED: 'Pagamento registrado',
  REPORT_GENERATED: 'Relatório gerado',
  BUDGET_CREATED: 'Orçamento cadastrado',
  APPROVAL_LIMIT_CREATED: 'Limite de aprovação cadastrado',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function actorLabel(log: AuditLog) {
  if (log.actor?.name) return log.actor.name;
  if (log.actorType === 'SYSTEM') return log.job ? `Sistema (${log.job})` : 'Sistema';
  return log.actorId ? `Usuário #${log.actorId}` : 'Usuário não identificado';
}

function formattedSnapshot(value: unknown) {
  if (value === null || value === undefined) return 'Não informado';
  return JSON.stringify(value, null, 2) ?? 'Não informado';
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap break-all">
        {formattedSnapshot(value)}
      </pre>
    </div>
  );
}

export function AuditPage() {
  const [draft, setDraft] = useState<AuditFilters>({ ...EMPTY_AUDIT_FILTERS });
  const [filters, setFilters] = useState<AuditFilters>({ ...EMPTY_AUDIT_FILTERS });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [filterError, setFilterError] = useState('');

  const query = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => fetchAuditLogs(filters, page),
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  function updateFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (filterError) setFilterError('');
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.actorId.trim() && (!/^\d+$/.test(draft.actorId.trim()) || Number(draft.actorId) < 1)) {
      setFilterError('O ID do usuário precisa ser um número positivo.');
      return;
    }
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError('A data inicial não pode ser posterior à data final.');
      return;
    }
    setFilterError('');
    setPage(1);
    setFilters({ ...draft });
  }

  function clearFilters() {
    setDraft({ ...EMPTY_AUDIT_FILTERS });
    setFilters({ ...EMPTY_AUDIT_FILTERS });
    setPage(1);
    setFilterError('');
  }

  return (
    <div className="space-y-6 text-slate-900" data-testid="audit-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Rastreabilidade</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ClipboardList className="h-6 w-6 text-[#164E3F]" /> Histórico e auditoria
          </h1>
          <p className="mt-2 text-sm text-slate-500">Consulte as ações registradas pelo sistema e seus responsáveis.</p>
        </div>
        <Button type="button" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </header>

      <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={applyFilters} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="audit-actor">ID do usuário</Label>
              <Input id="audit-actor" inputMode="numeric" placeholder="Ex.: 1" value={draft.actorId}
                onChange={(event) => updateFilter('actorId', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-action">Ação</Label>
              <Input id="audit-action" maxLength={100} placeholder="Ex.: REQUEST_CREATED" value={draft.action}
                onChange={(event) => updateFilter('action', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-entity">Tipo de entidade</Label>
              <Input id="audit-entity" maxLength={100} placeholder="Ex.: Request" value={draft.entityType}
                onChange={(event) => updateFilter('entityType', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-entity-id">ID da entidade</Label>
              <Input id="audit-entity-id" maxLength={100} placeholder="Ex.: 1" value={draft.entityId}
                onChange={(event) => updateFilter('entityId', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-from">De</Label>
              <Input id="audit-from" type="date" value={draft.from}
                onChange={(event) => updateFilter('from', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-to">Até</Label>
              <Input id="audit-to" type="date" value={draft.to}
                onChange={(event) => updateFilter('to', event.target.value)} />
            </div>
          </div>
          {filterError && <p className="text-sm text-red-700" role="alert">{filterError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
              <Search className="h-4 w-4" /> Aplicar filtros
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold">Registros de auditoria</h2>
          <span className="text-xs text-slate-500" aria-live="polite">
            {query.isLoading ? 'Carregando...' : `${total} registro(s)`}
          </span>
        </div>
        {query.isLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : query.isError ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-red-700">Não foi possível carregar o histórico.</p>
            <p className="mt-1 text-sm text-slate-500">Verifique a conexão com a API e sua permissão de auditoria.</p>
            <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>Tentar novamente</Button>
          </div>
        ) : !query.data?.items.length ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(log.occurredAt)}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{actorLabel(log)}</span>
                      {log.actor?.email && <p className="text-xs text-slate-500">{log.actor.email}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold">{ACTION_LABELS[log.action] ?? log.action}</span>
                      <p className="text-xs text-slate-500">{log.action}</p>
                    </TableCell>
                    <TableCell className="text-sm">{log.entityType} #{log.entityId}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelected(log)}>
                        <Eye className="h-4 w-4" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!query.isError && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page === 1 || query.isFetching}
                onClick={() => setPage((previous) => previous - 1)}>Anterior</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || query.isFetching}
                onClick={() => setPage((previous) => previous + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro #{selected?.id}</DialogTitle>
            <DialogDescription>Histórico registrado automaticamente pelo backend.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p><strong>Data:</strong> {formatDateTime(selected.occurredAt)}</p>
                <p><strong>Responsável:</strong> {actorLabel(selected)}</p>
                <p><strong>Ação:</strong> {selected.action}</p>
                <p><strong>Entidade:</strong> {selected.entityType} #{selected.entityId}</p>
              </div>
              {selected.justification && <p><strong>Justificativa:</strong> {selected.justification}</p>}
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Snapshot title="Antes" value={selected.before} />
                <Snapshot title="Depois" value={selected.after} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
