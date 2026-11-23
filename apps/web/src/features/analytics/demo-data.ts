import {
  assertNonNegativeAnalyticsValues,
  calculateCompletedPaymentTotal,
  calculateRequestTotals,
} from "./calculations"
import type {
  AnalyticsDataset,
  AuditEvent,
  Budget,
  Payment,
  ResourceRequest,
} from "./types"

/**
 * Demonstration-only fixture. This data is not persisted and must be replaced
 * by backend responses when the analytics API contract is available.
 */
export const DEMO_ANNUAL_BUDGET: Budget = {
  id: "demo-budget-2024",
  fiscalYear: 2024,
  currency: "BRL",
  annualTotal: 18_000_000,
  available: 8_432_000,
  provisioned: 3_145_000,
  utilized: 6_423_000,
  updatedAt: "2024-09-20T13:18:00.000Z",
  source: "demo",
}

export const DEMO_REQUESTS: ResourceRequest[] = [
  {
    id: "REQ-1001",
    title: "Estação de trabalho para processamento de imagens",
    requesterId: "USR-001",
    requesterName: "Carolina Mendes",
    purpose: "equipment",
    status: "paid",
    requestedAmount: 1_248_000,
    provisionedAmount: 0,
    utilizedAmount: 1_248_000,
    requestedAt: "2024-01-15T12:00:00.000Z",
    decidedAt: "2024-01-29T15:30:00.000Z",
  },
  {
    id: "REQ-1008",
    title: "Licenças de software para análise qualitativa",
    requesterId: "USR-002",
    requesterName: "Marina Alves",
    purpose: "software_licenses",
    status: "paid",
    requestedAmount: 975_000,
    provisionedAmount: 0,
    utilizedAmount: 975_000,
    requestedAt: "2024-02-12T14:00:00.000Z",
    decidedAt: "2024-03-01T16:00:00.000Z",
  },
  {
    id: "REQ-1016",
    title: "Participação em congresso nacional",
    requesterId: "USR-003",
    requesterName: "Lucas Soares",
    purpose: "academic_events",
    status: "paid",
    requestedAmount: 1_800_000,
    provisionedAmount: 0,
    utilizedAmount: 1_800_000,
    requestedAt: "2024-03-18T11:20:00.000Z",
    decidedAt: "2024-04-02T13:00:00.000Z",
  },
  {
    id: "REQ-1024",
    title: "Diárias para visita técnica",
    requesterId: "USR-004",
    requesterName: "Ana Ribeiro",
    purpose: "travel",
    status: "paid",
    requestedAmount: 750_000,
    provisionedAmount: 0,
    utilizedAmount: 750_000,
    requestedAt: "2024-04-22T09:00:00.000Z",
    decidedAt: "2024-05-06T14:45:00.000Z",
  },
  {
    id: "REQ-1031",
    title: "Materiais para protótipos de pesquisa",
    requesterId: "USR-005",
    requesterName: "Bruno Costa",
    purpose: "research_materials",
    status: "paid",
    requestedAmount: 1_650_000,
    provisionedAmount: 0,
    utilizedAmount: 1_650_000,
    requestedAt: "2024-05-10T10:15:00.000Z",
    decidedAt: "2024-05-24T17:00:00.000Z",
  },
  {
    id: "REQ-1041",
    title: "Equipamentos para laboratório de visão computacional",
    requesterId: "USR-001",
    requesterName: "Carolina Mendes",
    purpose: "equipment",
    status: "provisioned",
    requestedAmount: 1_248_000,
    provisionedAmount: 1_248_000,
    utilizedAmount: 0,
    requestedAt: "2024-08-19T13:30:00.000Z",
    decidedAt: "2024-09-02T15:00:00.000Z",
  },
  {
    id: "REQ-1044",
    title: "Renovação de licenças acadêmicas",
    requesterId: "USR-006",
    requesterName: "Fernanda Lima",
    purpose: "software_licenses",
    status: "provisioned",
    requestedAmount: 897_000,
    provisionedAmount: 897_000,
    utilizedAmount: 0,
    requestedAt: "2024-08-26T12:40:00.000Z",
    decidedAt: "2024-09-09T14:20:00.000Z",
  },
  {
    id: "REQ-1048",
    title: "Missão acadêmica interinstitucional",
    requesterId: "USR-007",
    requesterName: "Paulo Nunes",
    purpose: "travel",
    status: "provisioned",
    requestedAmount: 1_000_000,
    provisionedAmount: 1_000_000,
    utilizedAmount: 0,
    requestedAt: "2024-09-03T09:10:00.000Z",
    decidedAt: "2024-09-17T16:30:00.000Z",
  },
  {
    id: "REQ-1052",
    title: "Inscrição em simpósio internacional",
    requesterId: "USR-008",
    requesterName: "Renata Campos",
    purpose: "academic_events",
    status: "under_review",
    requestedAmount: 430_000,
    provisionedAmount: 0,
    utilizedAmount: 0,
    requestedAt: "2024-09-12T13:00:00.000Z",
  },
  {
    id: "REQ-1054",
    title: "Aquisição de sensores experimentais",
    requesterId: "USR-009",
    requesterName: "Diego Martins",
    purpose: "research_materials",
    status: "rejected",
    requestedAmount: 680_000,
    provisionedAmount: 0,
    utilizedAmount: 0,
    requestedAt: "2024-09-13T11:00:00.000Z",
    decidedAt: "2024-09-19T18:00:00.000Z",
  },
]

export const DEMO_PAYMENTS: Payment[] = [
  {
    id: "PAY-1001",
    requestId: "REQ-1001",
    amount: 1_248_000,
    status: "completed",
    paidAt: "2024-02-09T14:00:00.000Z",
    reference: "DEMO-2024-001",
  },
  {
    id: "PAY-1008",
    requestId: "REQ-1008",
    amount: 975_000,
    status: "completed",
    paidAt: "2024-03-15T14:00:00.000Z",
    reference: "DEMO-2024-002",
  },
  {
    id: "PAY-1016",
    requestId: "REQ-1016",
    amount: 1_800_000,
    status: "completed",
    paidAt: "2024-04-19T14:00:00.000Z",
    reference: "DEMO-2024-003",
  },
  {
    id: "PAY-1024",
    requestId: "REQ-1024",
    amount: 750_000,
    status: "completed",
    paidAt: "2024-05-17T14:00:00.000Z",
    reference: "DEMO-2024-004",
  },
  {
    id: "PAY-1031",
    requestId: "REQ-1031",
    amount: 1_650_000,
    status: "completed",
    paidAt: "2024-06-07T14:00:00.000Z",
    reference: "DEMO-2024-005",
  },
]

export const DEMO_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "AUD-0001",
    occurredAt: "2024-01-02T12:00:00.000Z",
    actorId: "SYSTEM",
    actorName: "Carga de demonstração",
    action: "budget_created",
    entityType: "budget",
    entityId: DEMO_ANNUAL_BUDGET.id,
    description: "Orçamento anual de demonstração criado.",
    nextValues: { annualTotal: DEMO_ANNUAL_BUDGET.annualTotal },
    source: "demo",
  },
  {
    id: "AUD-0002",
    occurredAt: "2024-09-02T15:00:00.000Z",
    actorId: "USR-010",
    actorName: "Ricardo Oliveira",
    action: "funds_provisioned",
    entityType: "request",
    entityId: "REQ-1041",
    description: "Valor de demonstração marcado como provisionado.",
    previousValues: { provisionedAmount: 0 },
    nextValues: { provisionedAmount: 1_248_000 },
    source: "demo",
  },
  {
    id: "AUD-0003",
    occurredAt: "2024-06-07T14:00:00.000Z",
    actorId: "USR-010",
    actorName: "Ricardo Oliveira",
    action: "payment_completed",
    entityType: "payment",
    entityId: "PAY-1031",
    description: "Pagamento de demonstração registrado como concluído.",
    previousValues: { status: "scheduled" },
    nextValues: { status: "completed", amount: 1_650_000 },
    source: "demo",
  },
]

export const DEMO_ANALYTICS_DATA: AnalyticsDataset = {
  budget: DEMO_ANNUAL_BUDGET,
  requests: DEMO_REQUESTS,
  payments: DEMO_PAYMENTS,
  auditEvents: DEMO_AUDIT_EVENTS,
}

function validateDemoAnalyticsData(dataset: AnalyticsDataset): void {
  assertNonNegativeAnalyticsValues(dataset)

  const requestTotals = calculateRequestTotals(dataset.requests)
  const paymentTotal = calculateCompletedPaymentTotal(dataset.payments)

  if (requestTotals.provisioned !== dataset.budget.provisioned) {
    throw new Error(
      "Demo provisioned requests must match the demo budget provisioned amount.",
    )
  }

  if (requestTotals.utilized !== dataset.budget.utilized) {
    throw new Error(
      "Demo utilized requests must match the demo budget utilized amount.",
    )
  }

  if (paymentTotal !== dataset.budget.utilized) {
    throw new Error(
      "Demo completed payments must match the demo budget utilized amount.",
    )
  }
}

validateDemoAnalyticsData(DEMO_ANALYTICS_DATA)
