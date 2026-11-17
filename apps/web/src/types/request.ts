// ============================================================
// Tipagens estritas do domínio de Solicitações Financeiras
// ============================================================

/** Status possíveis de uma solicitação financeira no ciclo de vida do DACOM */
export type RequestStatus =
  | 'DRAFT'
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
  DRAFT: 'Rascunho',
  AWAITING_VOTING: 'Aguardando Votação',
  IN_VOTING: 'Em Votação',
  AWAITING_COMPLEMENT: 'Aguardando Complemento',
  AWAITING_BALANCE: 'Aguardando Saldo',
  PROVISIONED: 'Aprovado',
  PAID: 'Pago',
  REJECTED: 'Rejeitado',
  CANCELED: 'Cancelado',
};

/** Categorias (rubricas) de despesa suportadas pelo backend */
export type ExpenseCategory =
  | 'MATERIAL_CONSUMO'
  | 'SERVICOS_TERCEIROS'
  | 'EQUIPAMENTOS'
  | 'DIARIAS_PASSAGENS'
  | 'OUTROS';

/** Labels legíveis em português para cada categoria de despesa */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MATERIAL_CONSUMO: 'Material de Consumo',
  SERVICOS_TERCEIROS: 'Serviços de Terceiros',
  EQUIPAMENTOS: 'Equipamentos',
  DIARIAS_PASSAGENS: 'Diárias e Passagens',
  OUTROS: 'Outros',
};

/** Modelo de Solicitação Financeira alinhado ao backend */
export interface Request {
  id: string;
  userId: string;
  category: ExpenseCategory;
  description: string;
  /** Valor em centavos (ex: 48000 = R$ 480,00) */
  amount: number;
  status: RequestStatus;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  updatedAt: string;
}

/** Alias de compatibilidade com referências legadas */
export type FinancialRequest = Request;

/** Resumo financeiro e métricas do período do docente */
export interface FinancialSummary {
  /** Limite acumulado do período em centavos */
  accumulatedLimit: number;
  /** Valor já utilizado/provisionado em centavos */
  usedAmount: number;
  /** Saldo disponível em centavos */
  availableAmount: number;
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
}

/** Paginação genérica da API */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Resposta de GET /api/requests alimentando cards de resumo e tabela */
export interface RequestsListResponse extends PaginatedResponse<Request> {
  summary: FinancialSummary;
}

/** Payload de criação de solicitação financeira (valor em centavos) */
export interface CreateRequestPayload {
  category: ExpenseCategory;
  description: string;
  amount: number;
  attachmentName?: string;
}

/** Payload de edição de solicitação financeira (amount omitido após aprovação) */
export interface UpdateRequestPayload {
  description: string;
  amount?: number;
  attachmentName?: string;
}

