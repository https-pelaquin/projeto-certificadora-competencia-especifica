import { apiClient } from '@/lib/api-client';
import type {
  CancelOperationalRequestPayload,
  OperationalRequest,
  OperationalRequestsPage,
  RequestComplementPayload,
} from '@/types/operational-request';
import type { RequestStatus } from '@/types/request';

export const fetchOperationalRequests = (status: RequestStatus) =>
  apiClient.get<OperationalRequestsPage>(
    `/api/requests?status=${status}&page=1&pageSize=100`,
  );

export const fetchOperationalRequest = (id: number) =>
  apiClient.get<OperationalRequest>(`/api/requests/${id}`);

export const requestOperationalComplement = (
  id: number,
  payload: RequestComplementPayload,
) =>
  apiClient.post<OperationalRequest>(
    `/api/requests/${id}/complement-requests`,
    payload,
  );

export const cancelOperationalRequest = (
  id: number,
  payload: CancelOperationalRequestPayload,
) =>
  apiClient.post<OperationalRequest>(`/api/requests/${id}/cancel`, payload);
