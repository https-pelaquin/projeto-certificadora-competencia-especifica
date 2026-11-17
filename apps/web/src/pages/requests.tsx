import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  XCircle,
  Pencil,
  Paperclip,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StatusBadge,
  EmptyState,
  TableSkeleton,
  ConfirmDialog,
} from '@/components/shared';
import { RequestModal } from '@/features/solicitations/request-modal';
import {
  useCancelRequest,
  useRequests,
} from '@/features/requests/api';
import {
  canCancelRequest,
  canEditRequest,
  canModifyRequest,
  isAmountLocked,
} from '@/features/requests/utils/request-state-machine';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  EXPENSE_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  type ExpenseCategory,
  type Request,
  type RequestStatus,
} from '@/types';

export function RequestsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Request | null>(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const {
    data: requestsResponse,
    isLoading,
    isError,
  } = useRequests();

  const cancelMutation = useCancelRequest();

  const allRequests = useMemo(
    () => requestsResponse?.data ?? [],
    [requestsResponse?.data],
  );

  // Filter requests
  const filteredRequests = useMemo(() => {
    return allRequests.filter((item) => {
      const matchSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        EXPENSE_CATEGORY_LABELS[item.category].toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [allRequests, searchQuery, categoryFilter, statusFilter]);

  const handleEdit = (request: Request) => {
    if (!canModifyRequest(request.status)) return;
    setEditingRequest(request);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingRequest(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="requests-page">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Solicitações de Recursos Financeiros
            </h1>
            <span
              data-testid="requests-total-count"
              className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#164E3F] text-white"
            >
              {allRequests.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Criação, edição e acompanhamento detalhado dos pedidos de recursos financeiros
          </p>
        </div>

        <Button
          data-testid="btn-new-request"
          onClick={handleNew}
          className="bg-[#164E3F] hover:bg-[#0F382C] text-white shadow-sm font-semibold gap-2 h-10 px-4 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid="input-search-requests"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição ou categoria..."
              className="pl-9 h-9 text-xs bg-slate-50/80 border-slate-200 focus:bg-white"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={categoryFilter}
              onValueChange={(val) => setCategoryFilter(val ?? 'ALL')}
            >
              <SelectTrigger data-testid="select-filter-category" className="h-9 text-xs w-[170px] bg-white border-slate-200">
                <SelectValue>
                  {(val: string | null) =>
                    !val || val === 'ALL'
                      ? 'Todas as Categorias'
                      : EXPENSE_CATEGORY_LABELS[val as ExpenseCategory] ?? val
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Todas as Categorias</SelectItem>
                {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val ?? 'ALL')}
            >
              <SelectTrigger data-testid="select-filter-status" className="h-9 text-xs w-[160px] bg-white border-slate-200">
                <SelectValue>
                  {(val: string | null) =>
                    !val || val === 'ALL'
                      ? 'Todos os Status'
                      : REQUEST_STATUS_LABELS[val as RequestStatus] ?? val
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Todos os Status</SelectItem>
                {(Object.entries(REQUEST_STATUS_LABELS) as [RequestStatus, string][]).map(([stKey, stLabel]) => (
                  <SelectItem key={stKey} value={stKey} className="text-xs">
                    {stLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                data-testid="btn-clear-filters"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 h-9"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : isError ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">Falha ao obter lista de solicitações</p>
              <p className="text-xs text-slate-500 mt-1">Por favor, recarregue a página ou contate o suporte.</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nenhuma solicitação encontrada"
                description={
                  searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os termos de busca.'
                    : 'Você ainda não possui pedidos cadastrados neste exercício orçamentário.'
                }
                action={
                  <Button
                    data-testid="btn-empty-new-request"
                    onClick={handleNew}
                    className="bg-[#164E3F] hover:bg-[#0F382C] text-white text-xs gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Criar Novo Pedido
                  </Button>
                }
              />
            </div>
          ) : (
            <Table data-testid="requests-table">
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200 text-slate-600">
                  <TableHead className="w-[180px] text-xs font-bold pl-6">Categoria</TableHead>
                  <TableHead className="text-xs font-bold">Descrição / Justificativa</TableHead>
                  <TableHead className="text-xs font-bold text-right">Valor (R$)</TableHead>
                  <TableHead className="text-xs font-bold">Data do Pedido</TableHead>
                  <TableHead className="text-xs font-bold">Comprovante</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const editable = canEditRequest(request.status);
                  const cancelable = canCancelRequest(request.status);
                  const lockedTooltip =
                    request.status === 'PAID'
                      ? 'Solicitação paga: ações bloqueadas'
                      : 'Ação indisponível para este status';

                  return (
                    <TableRow
                      key={request.id}
                      data-testid={`row-status-${request.status}`}
                      data-request-id={request.id}
                      className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 group"
                    >
                      {/* Categoria */}
                      <TableCell className="pl-6 font-semibold text-xs text-slate-900">
                        {EXPENSE_CATEGORY_LABELS[request.category]}
                      </TableCell>

                      {/* Descrição */}
                      <TableCell className="max-w-md">
                        <p className="text-xs text-slate-800 font-medium line-clamp-1" title={request.description}>
                          {request.description}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {request.id}</span>
                      </TableCell>

                      {/* Valor formatado */}
                      <TableCell className="text-right font-bold text-xs text-slate-900 tabular-nums">
                        {formatCurrency(request.amount)}
                      </TableCell>

                      {/* Data */}
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(request.createdAt)}
                      </TableCell>

                      {/* Anexo */}
                      <TableCell>
                        {request.attachmentName ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs text-[#164E3F] hover:text-[#0F382C] font-medium cursor-pointer"
                            title="Visualizar anexo"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="truncate max-w-[120px]">{request.attachmentName}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem anexo</span>
                        )}
                      </TableCell>

                      {/* Badge de Status Semântica */}
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>

                      {/* Ações com Máquina de Estados (PAID bloqueia Editar e Cancelar) */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            data-testid="btn-edit-request"
                            variant="ghost"
                            size="sm"
                            disabled={!editable}
                            onClick={() => handleEdit(request)}
                            className="h-8 px-2 text-slate-600 hover:text-[#164E3F] hover:bg-emerald-50 text-xs gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={editable ? 'Editar solicitação' : lockedTooltip}
                          >
                            {editable ? (
                              <Pencil className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Editar</span>
                          </Button>

                          <Button
                            data-testid="btn-cancel-request"
                            variant="ghost"
                            size="sm"
                            disabled={!cancelable}
                            onClick={() => {
                              if (cancelable) {
                                cancelMutation.reset();
                                setCancelTarget(request);
                              }
                            }}
                            className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={cancelable ? 'Cancelar solicitação' : lockedTooltip}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Cancelar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Modal Interativo de Criação/Edição */}
      <RequestModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        request={editingRequest}
        isAmountLocked={editingRequest ? isAmountLocked(editingRequest.status) : false}
      />

      {/* Modal de Confirmação Crítica para Cancelamento (com proteção anti double-submit) */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) {
            cancelMutation.reset();
            setCancelTarget(null);
          }
        }}
        title="Cancelar Solicitação Financeira?"
        description={`Você está prestes a cancelar a solicitação "${cancelTarget?.description}". Esta operação registrará o status CANCELED e liberará o saldo reservado.`}
        confirmLabel="Sim, Cancelar Solicitação"
        cancelLabel="Voltar"
        variant="destructive"
        confirmTestId="btn-confirm-cancel-request"
        onConfirm={() => {
          if (cancelTarget && !cancelMutation.isPending) {
            cancelMutation.mutate(cancelTarget.id, {
              onSuccess: () => {
                setCancelTarget(null);
              },
            });
          }
        }}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}

