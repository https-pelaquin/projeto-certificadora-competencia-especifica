import type {
  AnalyticsDataset,
  Budget,
  BudgetIndicators,
  MoneyInCents,
  MonthlyTotal,
  Payment,
  PurposeDistributionItem,
  RequestPurpose,
  RequestSituation,
  RequestSituationSummary,
  ResourceRequest,
} from "./types"

const requestSituations: Record<ResourceRequest["status"], RequestSituation> = {
  draft: "pending",
  submitted: "pending",
  under_review: "pending",
  approved: "pending",
  provisioned: "provisioned",
  partially_paid: "utilized",
  paid: "utilized",
  rejected: "closed",
  cancelled: "closed",
}

function assertFiniteNonNegativeInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer amount in cents.`)
  }
}

function percentage(part: MoneyInCents, total: MoneyInCents): number {
  return total === 0 ? 0 : (part / total) * 100
}

function monthFromIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(isoDate)

  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }

  return `${match[1]}-${match[2]}`
}

export function assertBudgetInvariant(budget: Budget): void {
  const entries: Array<[string, MoneyInCents]> = [
    ["annualTotal", budget.annualTotal],
    ["available", budget.available],
    ["provisioned", budget.provisioned],
    ["utilized", budget.utilized],
  ]

  entries.forEach(([label, value]) =>
    assertFiniteNonNegativeInteger(value, label),
  )

  const allocatedTotal = budget.available + budget.provisioned + budget.utilized
  if (allocatedTotal !== budget.annualTotal) {
    throw new Error(
      `Budget invariant failed: available + provisioned + utilized (${allocatedTotal}) must equal annualTotal (${budget.annualTotal}).`,
    )
  }
}

export function assertNonNegativeAnalyticsValues(
  dataset: AnalyticsDataset,
): void {
  assertBudgetInvariant(dataset.budget)
  calculateRequestTotals(dataset.requests)

  dataset.payments.forEach((payment, index) => {
    assertFiniteNonNegativeInteger(payment.amount, `payments[${index}].amount`)
  })
}

export function calculateBudgetIndicators(budget: Budget): BudgetIndicators {
  assertBudgetInvariant(budget)

  return {
    annualTotal: budget.annualTotal,
    available: budget.available,
    provisioned: budget.provisioned,
    utilized: budget.utilized,
    availablePercentage: percentage(budget.available, budget.annualTotal),
    provisionedPercentage: percentage(budget.provisioned, budget.annualTotal),
    utilizedPercentage: percentage(budget.utilized, budget.annualTotal),
  }
}

export function sumAmounts(values: MoneyInCents[]): MoneyInCents {
  return values.reduce((total, value, index) => {
    assertFiniteNonNegativeInteger(value, `values[${index}]`)
    return total + value
  }, 0)
}

export function calculateRequestTotals(requests: ResourceRequest[]) {
  return {
    requested: sumAmounts(requests.map((request) => request.requestedAmount)),
    provisioned: sumAmounts(
      requests.map((request) => request.provisionedAmount),
    ),
    utilized: sumAmounts(requests.map((request) => request.utilizedAmount)),
  }
}

export function calculateCompletedPaymentTotal(
  payments: Payment[],
): MoneyInCents {
  return sumAmounts(
    payments
      .filter((payment) => payment.status === "completed")
      .map((payment) => payment.amount),
  )
}

export function sumByMonth<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  getAmount: (item: T) => MoneyInCents,
): MonthlyTotal[] {
  const totals = new Map<string, MoneyInCents>()

  items.forEach((item, index) => {
    const date = getDate(item)
    if (!date) return

    const amount = getAmount(item)
    assertFiniteNonNegativeInteger(amount, `items[${index}]`)
    const month = monthFromIsoDate(date)
    totals.set(month, (totals.get(month) ?? 0) + amount)
  })

  return [...totals.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, amount]) => ({ month, amount }))
}

export function sumCompletedPaymentsByMonth(
  payments: Payment[],
): MonthlyTotal[] {
  return sumByMonth(
    payments.filter((payment) => payment.status === "completed"),
    (payment) => payment.paidAt,
    (payment) => payment.amount,
  )
}

export function classifyRequestSituation(
  status: ResourceRequest["status"],
): RequestSituation {
  return requestSituations[status]
}

export function summarizeRequestSituations(
  requests: ResourceRequest[],
): RequestSituationSummary[] {
  const situations: RequestSituation[] = [
    "pending",
    "provisioned",
    "utilized",
    "closed",
  ]

  return situations.map((situation) => {
    const matchingRequests = requests.filter(
      (request) => classifyRequestSituation(request.status) === situation,
    )

    return {
      situation,
      count: matchingRequests.length,
      requestedAmount: sumAmounts(
        matchingRequests.map((request) => request.requestedAmount),
      ),
    }
  })
}

export function calculatePurposeDistribution(
  requests: ResourceRequest[],
  amountField: "requestedAmount" | "provisionedAmount" | "utilizedAmount" = "requestedAmount",
): PurposeDistributionItem[] {
  const totals = new Map<RequestPurpose, {
    count: number
    amount: MoneyInCents
  }>()

  requests.forEach((request, index) => {
    const amount = request[amountField]
    assertFiniteNonNegativeInteger(amount, `requests[${index}].${amountField}`)
    const current = totals.get(request.purpose) ?? { count: 0, amount: 0 }
    totals.set(request.purpose, {
      count: current.count + 1,
      amount: current.amount + amount,
    })
  })

  const grandTotal = sumAmounts([...totals.values()].map((item) => item.amount))

  return [...totals.entries()]
    .map(([purpose, item]) => ({
      purpose,
      count: item.count,
      amount: item.amount,
      percentage: percentage(item.amount, grandTotal),
    }))
    .sort((left, right) => right.amount - left.amount)
}
