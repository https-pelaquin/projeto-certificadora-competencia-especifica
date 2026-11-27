import { useQuery } from '@tanstack/react-query';
import { fetchOperationalRequest, fetchOperationalRequests } from './operational-requests-api';
import type { RequestStatus } from '@/types/request';

export const operationalRequestsQueryKeys = {
  all: ['requests'] as const,
  details: () => [...operationalRequestsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...operationalRequestsQueryKeys.details(), id] as const,
  list: (status: RequestStatus, page: number, pageSize: number) =>
    [...operationalRequestsQueryKeys.all, 'list', status, page, pageSize] as const,
};

export function useOperationalRequests(status: RequestStatus, page: number, pageSize: number) {
  return useQuery({
    queryKey: operationalRequestsQueryKeys.list(status, page, pageSize),
    queryFn: () => fetchOperationalRequests(status, page, pageSize),
  });
}

export function useOperationalRequest(id: number | null) {
  return useQuery({
    queryKey: operationalRequestsQueryKeys.detail(id ?? 0),
    queryFn: () => fetchOperationalRequest(id as number),
    enabled: id !== null,
  });
}
