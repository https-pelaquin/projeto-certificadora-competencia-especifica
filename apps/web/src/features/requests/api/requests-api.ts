import { apiClient } from '@/lib/api-client';
import { cancelOperationalRequest } from '@/features/operational-requests/api/operational-requests-api';
import type {
  CancelRequestPayload,
  CreateRequestPayload,
  OperationalRequest,
  RequestsListResponse,
  UpdateRequestPayload,
} from '@/types';

/** Obtém a lista paginada de solicitações do usuário (`GET /api/requests`) */
export function fetchRequests(): Promise<RequestsListResponse> {
  return apiClient.get<RequestsListResponse>('/api/requests?page=1&pageSize=100');
}

/** Cria uma nova solicitação financeira (`POST /api/requests`) */
export function createRequest(
  payload: CreateRequestPayload,
): Promise<OperationalRequest> {
  return apiClient.post<OperationalRequest>('/api/requests', payload);
}

/** Atualiza uma solicitação existente respeitando a imutabilidade de valor pós-aprovação */
export function updateRequest(
  id: number | string,
  payload: UpdateRequestPayload,
): Promise<OperationalRequest> {
  return apiClient.patch<OperationalRequest>(
    `/api/requests/${encodeURIComponent(String(id))}`,
    payload,
  );
}

/** Cancela uma solicitação financeira via `POST /api/requests/:id/cancel` */
export function cancelRequest(
  id: number | string,
  payload: CancelRequestPayload = {},
): Promise<OperationalRequest> {
  return cancelOperationalRequest(Number(id), payload);
}

