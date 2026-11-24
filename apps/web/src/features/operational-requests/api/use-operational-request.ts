import { useQuery } from '@tanstack/react-query';
import { fetchOperationalRequest, fetchOperationalRequests } from './operational-requests-api';
import type { RequestStatus } from '@/types/request';

export const operationalRequestsQueryKeys = {
  all: ['requests'] as const,
  details: () => [...operationalRequestsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...operationalRequestsQueryKeys.details(), id] as const,
  list: (status: RequestStatus) => [...operationalRequestsQueryKeys.all, 'list', status] as const,
};

export function useOperationalRequests(status: RequestStatus) {
  return useQuery({
    queryKey: operationalRequestsQueryKeys.list(status),
    queryFn: () => fetchOperationalRequests(status),
  });
}

export function useOperationalRequest(id: number | null) {
  return useQuery({
    queryKey: operationalRequestsQueryKeys.detail(id ?? 0),
    queryFn: () => fetchOperationalRequest(id as number),
    enabled: id !== null,
  });
}
