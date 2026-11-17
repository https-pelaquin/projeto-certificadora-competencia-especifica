import type { Prisma, RequestStatus } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";
import * as approvalLimitService from "../budget/approval-limit.service";
import * as budgetService from "../budget/budget.service";

// Avaliação automática de uma solicitação. Exige o lock do orçamento (lockBudget) na mesma transação.
//   dentro do limite, com saldo ──► PROVISIONED
//   dentro do limite, sem saldo ──► AWAITING_BALANCE
//   acima do limite ────────────► AWAITING_VOTING
// Na reavaliação de uma solicitação já gravada, `excludeRequestId` evita contá-la duas vezes no acumulado.
export async function evaluateRequest(db: Db, data: {
    requesterId: number;
    budgetId: number;
    amount: Prisma.Decimal;
    now: Date;
    excludeRequestId?: number;
}) {
    const limit = await approvalLimitService.checkLimit(db, {
        requesterId: data.requesterId,
        newAmount: data.amount,
        now: data.now,
        excludeRequestId: data.excludeRequestId,
    });
    const balance = await budgetService.getBalance(db, data.budgetId);

    // TODO(pendente-cliente): sem saldo a solicitação espera em AWAITING_BALANCE (padrão provisório da arquitetura §14).
    const status: RequestStatus = !limit.withinLimit
        ? "AWAITING_VOTING"
        : balance.available.lessThan(data.amount)
          ? "AWAITING_BALANCE"
          : "PROVISIONED";

    return { status, approvalLimitId: limit.approvalLimitId };
}
