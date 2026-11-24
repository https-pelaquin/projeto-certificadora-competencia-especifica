import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import type {
  CancelOperationalRequestPayload,
  RequestComplementPayload,
} from '@/types/operational-request';
import {
  cancelOperationalRequest,
  requestOperationalComplement,
} from './operational-requests-api';

function useOperationalInvalidation() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
      queryClient.invalidateQueries({ queryKey: ['votings'] }),
      queryClient.invalidateQueries({ queryKey: ['finance'] }),
    ]);
}

export function useRequestOperationalComplement() {
  const invalidate = useOperationalInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RequestComplementPayload }) =>
      requestOperationalComplement(id, payload),
    onSuccess: async () => {
      toast.success('Solicitação de complementação registrada.');
      await invalidate();
    },
  });
}

export function useCancelOperationalRequest() {
  const invalidate = useOperationalInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CancelOperationalRequestPayload }) =>
      cancelOperationalRequest(id, payload),
    onSuccess: async () => {
      toast.success('Solicitação cancelada com sucesso.');
      await invalidate();
    },
  });
}
