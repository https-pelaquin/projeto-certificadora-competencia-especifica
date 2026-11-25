// ============================================================
// Tipagens estritas do domínio de Solicitações Financeiras
// ============================================================

/** Status possíveis de uma solicitação financeira no ciclo de vida do DACOM */
export type RequestStatus =
  | 'AWAITING_VOTING'
  | 'IN_VOTING'
  | 'AWAITING_COMPLEMENT'
  | 'AWAITING_BALANCE'
  | 'PROVISIONED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELED';

/** Labels legíveis em português para cada status */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  AWAITING_VOTING: 'Aguardando Votação',
  IN_VOTING: 'Em Votação',
  AWAITING_COMPLEMENT: 'Aguardando Complemento',
  AWAITING_BALANCE: 'Aguardando Saldo',
  PROVISIONED: 'Aprovado',
  PAID: 'Pago',
  REJECTED: 'Rejeitado',
  CANCELED: 'Cancelado',
};

import type {
  CancelOperationalRequestPayload,
  OperationalRequest,
  OperationalRequestListItem,
  OperationalRequestsPage,
} from './operational-request';

/** Modelo de Solicitação Financeira alinhado ao backend (`GET /api/requests`) */
export type Request = OperationalRequestListItem;
export type { OperationalRequest, CancelOperationalRequestPayload };

/** Alias de compatibilidade com referências legadas */
export type FinancialRequest = Request;

/** Resumo financeiro e métricas do período do docente */
export interface FinancialSummary {
  /** Limite acumulado do período em reais (quando disponível) */
  accumulatedLimit?: number | null;
  /** Valor já utilizado/provisionado em reais */
  usedAmount: number;
  /** Saldo disponível em reais (quando disponível) */
  availableAmount?: number | null;
  periodStart?: string;
  periodEnd?: string;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
}

/** Paginação genérica */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Resposta de GET /api/requests */
export type RequestsListResponse = OperationalRequestsPage;

/** Payload de criação de solicitação financeira (`POST /api/requests`) */
export interface CreateRequestPayload {
  categoryId: number;
  description: string;
  amount: string;
}

/** Payload de edição de solicitação financeira (`PATCH /api/requests/:id`) */
export interface UpdateRequestPayload {
  description?: string;
  categoryId?: number;
  amount?: string;
}

/** Payload de cancelamento de solicitação financeira (`POST /api/requests/:id/cancel`) */
export type CancelRequestPayload = CancelOperationalRequestPayload;

