import { useQuery } from '@tanstack/react-query';
import { fetchRequests } from './requests-api';

/** Chaves de cache padronizadas do TanStack Query para solicitações */
export const requestsQueryKeys = {
  all: ['requests'] as const,
  list: () => [...requestsQueryKeys.all, 'list'] as const,
};

/**
 * Hook de consulta de solicitações financeiras e resumo orçamentário do docente.
 * Consome `GET /api/requests` interceptado pelo MSW/backend.
 */
export function useRequests() {
  return useQuery({
    queryKey: requestsQueryKeys.list(),
    queryFn: fetchRequests,
  });
}

