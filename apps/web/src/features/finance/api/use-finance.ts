import { useQuery } from '@tanstack/react-query';
import {
  fetchApprovalLimits,
  fetchBudget,
  fetchBudgetLedger,
  fetchBudgets,
  fetchCategories,
} from './finance-api';

export const financeQueryKeys = {
  all: ['finance'] as const,
  budgets: () => [...financeQueryKeys.all, 'budgets'] as const,
  budget: (id: number) => [...financeQueryKeys.budgets(), id] as const,
  ledger: (id: number, page: number, pageSize: number) =>
    [...financeQueryKeys.budget(id), 'ledger', page, pageSize] as const,
  limits: () => [...financeQueryKeys.all, 'approval-limits'] as const,
  categories: () => [...financeQueryKeys.all, 'categories'] as const,
};

export function useBudgets() {
  return useQuery({ queryKey: financeQueryKeys.budgets(), queryFn: fetchBudgets });
}

export function useBudget(id: number | null) {
  return useQuery({
    queryKey: financeQueryKeys.budget(id ?? 0),
    queryFn: () => fetchBudget(id as number),
    enabled: id !== null,
  });
}

export function useBudgetLedger(
  id: number | null,
  page: number,
  pageSize = 10,
) {
  return useQuery({
    queryKey: financeQueryKeys.ledger(id ?? 0, page, pageSize),
    queryFn: () => fetchBudgetLedger(id as number, page, pageSize),
    enabled: id !== null,
  });
}

export function useApprovalLimits() {
  return useQuery({
    queryKey: financeQueryKeys.limits(),
    queryFn: fetchApprovalLimits,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: financeQueryKeys.categories(),
    queryFn: fetchCategories,
  });
}
