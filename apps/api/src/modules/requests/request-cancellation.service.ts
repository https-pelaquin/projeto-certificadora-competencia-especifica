import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError, ForbiddenError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import type { AuthUser } from "../../types/express";
import * as budgetService from "../budget/budget.service";
import * as votingsService from "../votings/votings.service";
import { notifyCanceled } from "./request-notifications";
import * as requestsService from "./requests.service";

type UserActor = Actor & { type: "USER" };

// Cancela a solicitação. O solicitante cancela as próprias; quem tem `requests:cancelAny` (o chefe) cancela
// qualquer uma, mas com justificativa. Votação aberta é cancelada e o provisionado volta ao disponível (RELEASE).
export async function cancelRequest(
    actor: UserActor,
    user: AuthUser,
    requestId: number,
    data: { justification?: string } = {},
    now = new Date(),
) {
    const justification = data.justification?.trim() || undefined;

    return prisma.$transaction(async (tx) => {
        // Ordem de locks do sistema: Request → Voting → Budget.
        const request = await requestsService.getLocked(tx, requestId);

        const isOwner = request.requesterId === actor.userId;
        if (!isOwner && !user.permissions.has("requests:cancelAny")) {
            throw new ForbiddenError("Só o solicitante ou o chefe podem cancelar esta solicitação");
        }
        if (!isOwner && !justification) {
            throw new BusinessRuleError("Informe a justificativa do cancelamento");
        }
        if (request.status === "PAID" || request.status === "REJECTED" || request.status === "CANCELED") {
            throw new ConflictError("Esta solicitação não pode mais ser cancelada");
        }

        await votingsService.cancelForRequest(tx, requestId, actor, now);

        if (request.status === "PROVISIONED") {
            await budgetService.lockBudget(tx, request.budgetId);
            const provisioned = await budgetService.getRequestProvisioned(tx, requestId);
            if (provisioned.greaterThan(0)) {
                await budgetService.release(tx, actor, {
                    budgetId: request.budgetId,
                    requestId,
                    amount: provisioned,
                    justification,
                });
            }
        }

        const after = await requestsService.changeStatus(tx, actor, requestId, request.status, "CANCELED", justification);
        // Quem cancela a própria solicitação já sabe; o aviso é para quando o chefe cancela a de outra pessoa.
        if (!isOwner) {
            await notifyCanceled(tx, request, justification);
        }
        return after;
    });
}
