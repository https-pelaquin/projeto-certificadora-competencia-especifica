import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { requestsQueryKeys } from '@/features/requests/api';
import type {
  CreateApprovalLimitPayload,
  CreateBudgetAdjustmentPayload,
  CreateBudgetPayload,
  CreateCategoryPayload,
  PaymentPayload,
  UpdateCategoryPayload,
} from '@/types/finance';
import {
  adjustBudget,
  createApprovalLimit,
  createBudget,
  createCategory,
  provisionRequest,
  recordPayment,
  updateCategory,
} from './finance-api';
import { financeQueryKeys } from './use-finance';

function useFinanceInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: requestsQueryKeys.all }),
    ]);
  };
}

export function useCreateBudget() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateBudgetPayload) => createBudget(payload),
    onSuccess: async () => {
      toast.success('Orçamento criado com sucesso.');
      await invalidate();
    },
  });
}

export function useAdjustBudget() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CreateBudgetAdjustmentPayload }) =>
      adjustBudget(id, payload),
    onSuccess: async () => {
      toast.success('Ajuste registrado com sucesso.');
      await invalidate();
    },
  });
}

export function useCreateApprovalLimit() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateApprovalLimitPayload) => createApprovalLimit(payload),
    onSuccess: async () => {
      toast.success('Limite de aprovação criado com sucesso.');
      await invalidate();
    },
  });
}

export function useCreateCategory() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => createCategory(payload),
    onSuccess: async () => {
      toast.success('Categoria criada com sucesso.');
      await invalidate();
    },
  });
}

export function useUpdateCategory() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCategoryPayload }) =>
      updateCategory(id, payload),
    onSuccess: async () => {
      toast.success('Categoria atualizada com sucesso.');
      await invalidate();
    },
  });
}

export function useProvisionRequest() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (requestId: number) => provisionRequest(requestId),
    onSuccess: async () => {
      toast.success('Solicitação provisionada com sucesso.');
      await invalidate();
    },
  });
}

export function useRecordPayment() {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: PaymentPayload }) =>
      recordPayment(requestId, payload),
    onSuccess: async () => {
      toast.success('Pagamento registrado com sucesso.');
      await invalidate();
    },
  });
}
