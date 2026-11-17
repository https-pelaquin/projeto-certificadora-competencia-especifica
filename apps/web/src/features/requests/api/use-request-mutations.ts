import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelRequest,
  createRequest,
  updateRequest,
} from './requests-api';
import { requestsQueryKeys } from './use-requests';
import type { CreateRequestPayload, UpdateRequestPayload } from '@/types';

export interface UpdateRequestVariables {
  id: string;
  payload: UpdateRequestPayload;
}

/** Mutation para criação de nova solicitação financeira */
export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRequestPayload) => createRequest(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: requestsQueryKeys.all });
    },
  });
}

/** Mutation para edição de solicitação financeira */
export function useUpdateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateRequestVariables) =>
      updateRequest(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: requestsQueryKeys.all });
    },
  });
}

/** Mutation para cancelamento de solicitação financeira */
export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelRequest(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: requestsQueryKeys.all });
    },
  });
}

