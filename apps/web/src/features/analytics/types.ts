export type CurrencyCode = "BRL"

/**
 * Monetary value in cents. Keeping analytics values as integers avoids
 * floating-point rounding errors in totals and percentages.
 */
export type MoneyInCents = number

export type AnalyticsDataSource = "demo" | "api"

export type Budget = {
  id: string
  fiscalYear: number
  currency: CurrencyCode
  annualTotal: MoneyInCents
  available: MoneyInCents
  provisioned: MoneyInCents
  utilized: MoneyInCents
  updatedAt: string
  source: AnalyticsDataSource
}

export type RequestPurpose = "academic_events" | "equipment" | "research_materials" | "software_licenses" | "travel"

export type RequestStatus = "draft" | "submitted" | "under_review" | "approved" | "provisioned" | "partially_paid" | "paid" | "rejected" | "cancelled"

export type ResourceRequest = {
  id: string
  title: string
  requesterId: string
  requesterName: string
  purpose: RequestPurpose
  status: RequestStatus
  requestedAmount: MoneyInCents
  provisionedAmount: MoneyInCents
  utilizedAmount: MoneyInCents
  requestedAt: string
  decidedAt?: string
}

export type PaymentStatus = "scheduled" | "completed" | "cancelled"

export type Payment = {
  id: string
  requestId: string
  amount: MoneyInCents
  status: PaymentStatus
  paidAt?: string
  reference?: string
}

export type BudgetIndicators = {
  annualTotal: MoneyInCents
  available: MoneyInCents
  provisioned: MoneyInCents
  utilized: MoneyInCents
  availablePercentage: number
  provisionedPercentage: number
  utilizedPercentage: number
}

export type RequestSituation = "pending" | "provisioned" | "utilized" | "closed"

export type RequestSituationSummary = {
  situation: RequestSituation
  count: number
  requestedAmount: MoneyInCents
}

export type AnalyticsFilters = {
  fiscalYear?: number
  startDate?: string
  endDate?: string
  purposes?: RequestPurpose[]
  statuses?: RequestStatus[]
  requesterId?: string
  minimumAmount?: MoneyInCents
  maximumAmount?: MoneyInCents
  search?: string
}

export type MonthlyTotal = {
  month: string
  amount: MoneyInCents
}

export type PurposeDistributionItem = {
  purpose: RequestPurpose
  count: number
  amount: MoneyInCents
  percentage: number
}

export type AuditAction = "budget_created" | "request_created" | "request_status_changed" | "funds_provisioned" | "payment_completed" | "request_cancelled" | "funds_returned"

export type AuditEntityType = "budget" | "request" | "payment"

export type AuditEvent = {
  id: string
  occurredAt: string
  actorId: string
  actorName: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  description: string
  previousValues?: Record<string, string | number | null>
  nextValues?: Record<string, string | number | null>
  source: AnalyticsDataSource
}

export type AnalyticsDataset = {
  budget: Budget
  requests: ResourceRequest[]
  payments: Payment[]
  auditEvents: AuditEvent[]
}
