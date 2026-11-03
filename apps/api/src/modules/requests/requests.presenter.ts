import type { Prisma, RequestStatus } from "../../../generated/prisma/client";
import { moneyOut } from "../../shared/money";

type Named = { id: number; name: string };

type Summary = {
    id: number;
    status: RequestStatus;
    description: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    requester: Named;
    category: Named;
};

export const requestOut = (request: Summary) => ({
    id: request.id,
    status: request.status,
    description: request.description,
    amount: moneyOut(request.amount),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requester: request.requester,
    category: request.category,
});

type AuditRow = {
    action: string;
    occurredAt: Date;
    justification: string | null;
    before: unknown;
    after: unknown;
    actor: { id: number; name: string; email: string } | null;
};

// Linha do tempo só com a vida da solicitação; e-mail e dados internos do auditor ficam de fora.
function timelineOut(log: AuditRow) {
    const statusOf = (value: unknown) => (value as { status?: string } | null)?.status ?? null;
    const changesStatus = log.action === "REQUEST_STATUS_CHANGED";
    return {
        at: log.occurredAt,
        action: log.action,
        actor: log.actor ? { id: log.actor.id, name: log.actor.name } : null,
        fromStatus: changesStatus ? statusOf(log.before) : null,
        toStatus: changesStatus || log.action === "REQUEST_CREATED" ? statusOf(log.after) : null,
        justification: log.justification,
    };
}

type Detail = Summary & {
    budget: { id: number; year: number };
    approvalLimit: { id: number; amount: Prisma.Decimal; periodMonths: number };
    payment: { id: number; paidAmount: Prisma.Decimal; justification: string | null; paidAt: Date; recordedById: number } | null;
    complementRequests: { id: number; message: string; createdAt: Date; requestedBy: Named }[];
};

export function requestDetailOut(detail: { request: Detail; provisioned: Prisma.Decimal; history: AuditRow[] }) {
    const { request, provisioned, history } = detail;
    return {
        ...requestOut(request),
        budget: request.budget,
        approvalLimit: {
            id: request.approvalLimit.id,
            amount: moneyOut(request.approvalLimit.amount),
            periodMonths: request.approvalLimit.periodMonths,
        },
        amounts: {
            requested: moneyOut(request.amount),
            provisioned: moneyOut(provisioned),
            paid: request.payment ? moneyOut(request.payment.paidAmount) : null,
        },
        payment: request.payment && {
            id: request.payment.id,
            paidAmount: moneyOut(request.payment.paidAmount),
            justification: request.payment.justification,
            paidAt: request.payment.paidAt,
        },
        complementRequests: request.complementRequests.map((c) => ({
            id: c.id,
            message: c.message,
            requestedBy: c.requestedBy,
            createdAt: c.createdAt,
        })),
        timeline: history.map(timelineOut),
    };
}
