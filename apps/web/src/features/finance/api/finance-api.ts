import { apiClient } from '@/lib/api-client';
import type {
  ApprovalLimit,
  Budget,
  BudgetBalance,
  CreateApprovalLimitPayload,
  CreateBudgetAdjustmentPayload,
  CreateBudgetPayload,
  CreateCategoryPayload,
  ExpenseCategory,
  LedgerPage,
  PaymentPayload,
  PaymentResult,
  ProvisionedRequest,
  UpdateCategoryPayload,
} from '@/types/finance';

export const fetchBudgets = () => apiClient.get<Budget[]>('/api/budgets');

export const fetchBudget = (id: number) =>
  apiClient.get<Budget>(`/api/budgets/${id}`);

export const createBudget = (payload: CreateBudgetPayload) =>
  apiClient.post<Budget>('/api/budgets', payload);

export const adjustBudget = (
  id: number,
  payload: CreateBudgetAdjustmentPayload,
) =>
  apiClient.post<{ balance: BudgetBalance }>(
    `/api/budgets/${id}/adjustments`,
    payload,
  );

export const fetchBudgetLedger = (
  id: number,
  page: number,
  pageSize: number,
) =>
  apiClient.get<LedgerPage>(
    `/api/budgets/${id}/ledger?page=${page}&pageSize=${pageSize}`,
  );

export const fetchApprovalLimits = () =>
  apiClient.get<ApprovalLimit[]>('/api/approval-limits');

export const createApprovalLimit = (payload: CreateApprovalLimitPayload) =>
  apiClient.post<ApprovalLimit>('/api/approval-limits', payload);

export const fetchCategories = () =>
  apiClient.get<ExpenseCategory[]>('/api/categories');

export const createCategory = (payload: CreateCategoryPayload) =>
  apiClient.post<ExpenseCategory>('/api/categories', payload);

export const updateCategory = (
  id: number,
  payload: UpdateCategoryPayload,
) => apiClient.patch<ExpenseCategory>(`/api/categories/${id}`, payload);

export const provisionRequest = (requestId: number) =>
  apiClient.post<ProvisionedRequest>(`/api/requests/${requestId}/provision`);

export const recordPayment = (requestId: number, payload: PaymentPayload) =>
  apiClient.post<PaymentResult>(`/api/requests/${requestId}/payment`, payload);
