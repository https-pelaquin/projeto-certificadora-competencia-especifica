export type Money = string;

export interface BudgetBalance {
  total: Money;
  available: Money;
  provisioned: Money;
  spent: Money;
}

export interface Budget {
  id: number;
  year: number;
  initialAmount: Money;
  createdAt: string;
  balance: BudgetBalance;
}

export interface CreateBudgetPayload {
  year: number;
  initialAmount: Money;
}

export type BudgetAdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export interface CreateBudgetAdjustmentPayload {
  type: BudgetAdjustmentType;
  amount: Money;
  justification: string;
}

export type LedgerEntryType =
  | BudgetAdjustmentType
  | 'PROVISION'
  | 'RELEASE'
  | 'SPEND';

export interface LedgerEntry {
  id: number;
  type: LedgerEntryType;
  amount: Money;
  requestId: number | null;
  justification: string | null;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
}

export interface LedgerPage {
  items: LedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApprovalLimit {
  id: number;
  amount: Money;
  periodMonths: number;
  validFrom: string;
  validUntil: string | null;
}

export interface CreateApprovalLimitPayload {
  amount: Money;
  periodMonths: number;
  validFrom?: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  active: boolean;
}

export interface CreateCategoryPayload {
  name: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  active?: boolean;
}

export interface PaymentPayload {
  paidAmount: Money;
  justification?: string;
}

export interface PaymentResult {
  payment: {
    id: number;
    requestId: number;
    paidAmount: Money;
    justification: string | null;
    paidAt: string;
  };
  balance: BudgetBalance;
}

export interface ProvisionedRequest {
  id: number;
  status: string;
  description: string;
  amount: Money;
  amounts: {
    requested: Money;
    provisioned: Money;
    paid: Money | null;
  };
}
