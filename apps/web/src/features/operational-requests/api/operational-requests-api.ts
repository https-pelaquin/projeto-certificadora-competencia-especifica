import { apiClient } from '@/lib/api-client';
import type {
  CancelOperationalRequestPayload,
  OperationalRequest,
  OperationalRequestsPage,
  RequestComplementPayload,
  RequestComplementResult,
} from '@/types/operational-request';
import type { RequestStatus } from '@/types/request';

export const fetchOperationalRequests = (
  status: RequestStatus,
  page: number,
  pageSize: number,
) =>
  apiClient.get<OperationalRequestsPage>(
    `/api/requests?status=${status}&page=${page}&pageSize=${pageSize}`,
  );

export const fetchOperationalRequest = (id: number) =>
  apiClient.get<OperationalRequest>(`/api/requests/${id}`);

export const requestOperationalComplement = (
  id: number,
  payload: RequestComplementPayload,
) =>
  apiClient.post<RequestComplementResult>(
    `/api/requests/${id}/complement-requests`,
    payload,
  );

export const cancelOperationalRequest = (
  id: number,
  payload: CancelOperationalRequestPayload,
) =>
  apiClient.post<OperationalRequest>(`/api/requests/${id}/cancel`, payload);
