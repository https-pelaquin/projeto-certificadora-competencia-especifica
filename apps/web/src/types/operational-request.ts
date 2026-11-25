import type { RequestStatus } from '@/types/request';

export type OperationalMoney = string;

export interface OperationalPerson {
  id: number;
  name: string;
}

export interface OperationalRequest {
  id: number;
  status: RequestStatus;
  description: string;
  amount: OperationalMoney;
  createdAt: string;
  updatedAt: string;
  requester: OperationalPerson;
  category: {
    id: number;
    name: string;
  };
  budget: {
    id: number;
    year: number;
  } | null;
  approvalLimit: {
    id: number;
    amount: OperationalMoney;
    periodMonths: number;
  } | null;
  amounts: {
    requested: OperationalMoney;
    provisioned: OperationalMoney | null;
    paid: OperationalMoney | null;
  };
  payment: {
    id: number;
    paidAmount: OperationalMoney;
    justification: string | null;
    paidAt: string;
  } | null;
  complementRequests: Array<{
    id: number;
    message: string;
    requestedBy: OperationalPerson;
    createdAt: string;
  }>;
  timeline: Array<{
    at: string;
    action: string;
    actor: OperationalPerson | null;
    fromStatus: RequestStatus | null;
    toStatus: RequestStatus | null;
    justification: string | null;
  }>;
}

export type OperationalRequestListItem = Pick<
  OperationalRequest,
  'id' | 'status' | 'description' | 'amount' | 'createdAt' | 'updatedAt' | 'requester' | 'category'
> & {
  canEdit?: boolean;
  canCancel?: boolean;
};

export interface OperationalRequestsPage {
  items: OperationalRequestListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RequestComplementPayload {
  message: string;
}

export interface CancelOperationalRequestPayload {
  justification?: string;
}
