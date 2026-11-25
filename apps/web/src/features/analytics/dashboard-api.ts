import { apiClient } from '@/lib/api-client'

// Contrato real da API: valores financeiros são strings decimais em reais.
// O frontend NÃO recalcula saldos do orçamento.
export type AnalyticsRequestStatus =
  | 'AWAITING_VOTING'
  | 'AWAITING_COMPLEMENT'
  | 'AWAITING_BALANCE'
  | 'IN_VOTING'
  | 'PROVISIONED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELED'

export interface DashboardResponse {
  year: number
  budget: { id: number; initialAmount: string }
  balance: {
    total: string
    available: string
    provisioned: string
    spent: string
  }
  requests: {
    total: number
    byStatus: Array<{
      status: AnalyticsRequestStatus
      count: number
      amount: string
    }>
  }
  byMonth: Array<{
    month: string
    requested: string
    requestCount: number
    paid: string
  }>
  topRequesters: Array<{
    id: number
    name: string
    count: number
    amount: string
  }>
  topCategories: Array<{
    id: number
    name: string
    count: number
    amount: string
  }>
}

export interface AnalyticsRequestItem {
  id: number
  description: string
  status: AnalyticsRequestStatus
  amount: string
  createdAt: string
  updatedAt: string
  requester: { id: number; name: string }
  category: { id: number; name: string }
}

export interface AnalyticsRequestsPage {
  items: AnalyticsRequestItem[]
  total: number
  page: number
  pageSize: number
}

export interface AnalyticsCategory {
  id: number
  name: string
  active?: boolean
}

export interface AnalyticsRequestFilters {
  year: number
  page: number
  pageSize?: number
  categoryId?: number
  status?: AnalyticsRequestStatus
}

export function fetchDashboard(year: number) {
  return apiClient.get<DashboardResponse>(`/api/dashboard?year=${year}`, {
    skipErrorToast: true,
  })
}

export function fetchAnalyticsCategories() {
  return apiClient.get<AnalyticsCategory[]>('/api/categories', {
    skipErrorToast: true,
  })
}

export function fetchAnalyticsRequests({
  year,
  page,
  pageSize = 20,
  categoryId,
  status,
}: AnalyticsRequestFilters) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    // Fronteiras do ano no horário de Brasília. O limite `to` é exclusivo.
    from: `${year}-01-01T00:00:00-03:00`,
    to: `${year + 1}-01-01T00:00:00-03:00`,
  })
  if (categoryId !== undefined) params.set('categoryId', String(categoryId))
  if (status) params.set('status', status)

  return apiClient.get<AnalyticsRequestsPage>(`/api/requests?${params.toString()}`, {
    skipErrorToast: true,
  })
}
