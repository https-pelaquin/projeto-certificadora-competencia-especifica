import type { Prisma } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError, ForbiddenError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import * as categoriesService from "../categories/categories.service";
import { evaluateRequest } from "./request-evaluation";
import { notifyProvisioned } from "./request-notifications";
import * as requestsRepository from "./requests.repository";
import * as requestsService from "./requests.service";

type UserActor = Actor & { type: "USER" };

// Só o solicitante edita. O texto e a categoria mudam até PAID; o valor só antes da aprovação
// (AWAITING_VOTING ou AWAITING_COMPLEMENT). Depois disso, mudar o valor = cancelar e criar outra. [VALIDAR]
// Mudar o valor, ou editar uma solicitação que aguardava complementação, dispara nova avaliação.
export async function editRequest(
    actor: UserActor,
    requestId: number,
    data: { description?: string; categoryId?: number; amount?: Prisma.Decimal },
    now = new Date(),
) {
    const description = data.description?.trim();
    if (data.description !== undefined && !description) {
        throw new BusinessRuleError("Informe a descrição da solicitação");
    }
    if (data.amount && data.amount.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError("O valor da solicitação deve ser maior que zero");
    }

    return prisma.$transaction(async (tx) => {
        const request = await requestsService.getLocked(tx, requestId);

        if (request.requesterId !== actor.userId) {
            throw new ForbiddenError("Só o solicitante pode editar esta solicitação");
        }
        if (request.status === "PAID" || request.status === "REJECTED" || request.status === "CANCELED") {
            throw new ConflictError("Esta solicitação não pode mais ser editada");
        }

        const amountChanged = data.amount !== undefined && !data.amount.equals(request.amount);
        if (amountChanged && request.status !== "AWAITING_VOTING" && request.status !== "AWAITING_COMPLEMENT") {
            throw new BusinessRuleError("O valor só pode ser alterado antes da votação. Cancele e crie uma nova solicitação.");
        }
        if (data.categoryId !== undefined && data.categoryId !== request.categoryId) {
            await categoriesService.requireActive(tx, data.categoryId);
        }

        const amount = data.amount ?? request.amount;
        const reevaluate = amountChanged || request.status === "AWAITING_COMPLEMENT";
        let status = request.status;
        let approvalLimitId = request.approvalLimitId;

        if (reevaluate) {
            await budgetService.lockBudget(tx, request.budgetId);
            const evaluation = await evaluateRequest(tx, {
                requesterId: request.requesterId,
                budgetId: request.budgetId,
                amount,
                now,
                excludeRequestId: request.id,
            });
            status = evaluation.status;
            approvalLimitId = evaluation.approvalLimitId;
        }

        const after = await requestsRepository.update(tx, requestId, {
            description,
            categoryId: data.categoryId,
            amount: amountChanged ? amount : undefined,
            approvalLimitId: reevaluate ? approvalLimitId : undefined,
        });
        await audit.record(tx, actor, { action: "REQUEST_UPDATED", entityType: "Request", entityId: requestId, before: request, after });

        if (status === request.status) {
            return after;
        }

        if (status === "PROVISIONED") {
            const provisioned = await budgetService.tryProvision(tx, actor, { budgetId: request.budgetId, requestId, amount });
            if (!provisioned) {
                // Não deveria acontecer: o saldo foi lido sob o lock do orçamento, na mesma transação.
                throw new Error("Saldo mudou durante a reavaliação da solicitação");
            }
        }
        const changed = await requestsService.changeStatus(tx, actor, requestId, request.status, status);
        if (status === "PROVISIONED") {
            await notifyProvisioned(tx, changed);
        }
        return changed;
    });
}
