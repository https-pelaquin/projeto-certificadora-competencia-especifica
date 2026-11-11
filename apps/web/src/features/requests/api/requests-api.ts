import { apiFetch } from '@/lib/http';
import type {
  CreateRequestPayload,
  Request,
  RequestsListResponse,
  UpdateRequestPayload,
} from '@/types';

/** Obtém a lista de solicitações e o resumo de limite acumulado do docente */
export function fetchRequests(): Promise<RequestsListResponse> {
  return apiFetch<RequestsListResponse>('/api/requests');
}

/** Cria uma nova solicitação financeira */
export function createRequest(payload: CreateRequestPayload): Promise<Request> {
  return apiFetch<Request>('/api/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Atualiza uma solicitação existente respeitando a imutabilidade de valor pós-aprovação */
export function updateRequest(
  id: string,
  payload: UpdateRequestPayload,
): Promise<Request> {
  return apiFetch<Request>(`/api/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Cancela uma solicitação financeira, liberando saldo reservado */
export function cancelRequest(id: string): Promise<Request> {
  return apiFetch<Request>(`/api/requests/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
  });
}

