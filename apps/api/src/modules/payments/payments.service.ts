import { Prisma } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import { notifyPaymentRecorded } from "../requests/request-notifications";
import * as requestsService from "../requests/requests.service";
import * as paymentsRepository from "./payments.repository";

type UserActor = Actor & { type: "USER" };

// O chefe registra o pagamento de uma solicitação provisionada (a permissão `payments:record` é checada na rota).
//   igual ao provisionado ──► SPEND(pago)
//   menor                 ──► SPEND(pago) + RELEASE(diferença), com justificativa
//   maior                 ──► PROVISION(diferença) + SPEND(pago), com justificativa e exigindo saldo
export async function recordPayment(
    actor: UserActor,
    requestId: number,
    data: { paidAmount: Prisma.Decimal; justification?: string },
) {
    const justification = data.justification?.trim() || undefined;
    if (data.paidAmount.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError("O valor pago deve ser maior que zero");
    }

    return prisma.$transaction(async (tx) => {
        // Ordem de locks do sistema: Request → Voting → Budget. O status sob lock impede pagar duas vezes.
        const request = await requestsService.getLocked(tx, requestId);
        if (request.status !== "PROVISIONED") {
            throw new ConflictError("A solicitação não está provisionada");
        }

        await budgetService.lockBudget(tx, request.budgetId);
        const provisioned = await budgetService.getRequestProvisioned(tx, requestId);
        const difference = data.paidAmount.minus(provisioned);

        if (!difference.isZero() && !justification) {
            throw new BusinessRuleError("Informe a justificativa: o valor pago difere do provisionado");
        }

        const entry = { budgetId: request.budgetId, requestId, justification };

        if (difference.greaterThan(0)) {
            const covered = await budgetService.tryProvision(tx, actor, { ...entry, amount: difference });
            if (!covered) {
                throw new BusinessRuleError("O saldo disponível não cobre a diferença do pagamento");
            }
        }
        await budgetService.spend(tx, actor, { ...entry, amount: data.paidAmount });
        if (difference.lessThan(0)) {
            await budgetService.release(tx, actor, { ...entry, amount: difference.abs() });
        }

        const payment = await paymentsRepository.create(tx, {
            requestId,
            recordedById: actor.userId,
            paidAmount: data.paidAmount,
            justification,
        });
        await requestsService.changeStatus(tx, actor, requestId, request.status, "PAID");
        await notifyPaymentRecorded(tx, request, payment);
        await audit.record(tx, actor, {
            action: "PAYMENT_RECORDED",
            entityType: "Payment",
            entityId: payment.id,
            after: payment,
            justification,
        });

        return { payment, balance: await budgetService.getBalance(tx, request.budgetId) };
    });
}
