import type { RequestStatus, VotingResult } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type { Db } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import * as requestsRepository from "./requests.repository";

// Todos exceto rejeitadas e canceladas: impede dividir um pedido grande para fugir do conselho. [VALIDAR]
export const STATUSES_COUNTED_IN_LIMIT: RequestStatus[] = [
    "AWAITING_VOTING",
    "AWAITING_COMPLEMENT",
    "AWAITING_BALANCE",
    "IN_VOTING",
    "PROVISIONED",
    "PAID",
];

export function sumAccumulatedByRequester(db: Db, data: { requesterId: number; since: Date; excludeRequestId?: number }) {
    return requestsRepository.sumByRequester(db, { ...data, statuses: STATUSES_COUNTED_IN_LIMIT });
}

async function changeStatus(db: Db, actor: Actor, id: number, from: RequestStatus, to: RequestStatus) {
    const after = await requestsRepository.updateStatus(db, id, to);
    await audit.record(db, actor, {
        action: "REQUEST_STATUS_CHANGED",
        entityType: "Request",
        entityId: id,
        before: { status: from },
        after: { status: to },
    });
    return after;
}

// --- Contratos usados pelo módulo de votações (Pessoa 2) ---

// Trava a solicitação até o fim da transação.
export async function getForVoting(db: Db, id: number) {
    if (!(await requestsRepository.lock(db, id))) {
        throw new NotFoundError("Solicitação não encontrada");
    }
    return (await requestsRepository.findById(db, id))!;
}

export async function markInVoting(db: Db, id: number, actor: Actor) {
    const request = await getForVoting(db, id);
    if (request.status !== "AWAITING_VOTING") {
        throw new ConflictError("A solicitação não está aguardando votação");
    }
    return changeStatus(db, actor, id, request.status, "IN_VOTING");
}

// Aprovada: provisiona se houver saldo, senão fica AWAITING_BALANCE (a decisão do conselho não se perde). [VALIDAR]
export async function applyVotingResult(db: Db, id: number, result: VotingResult, actor: Actor) {
    const request = await getForVoting(db, id);
    if (request.status !== "IN_VOTING") {
        throw new ConflictError("A solicitação não está em votação");
    }

    if (result === "REJECTED") {
        return changeStatus(db, actor, id, request.status, "REJECTED");
    }

    await budgetService.lockBudget(db, request.budgetId);
    const provisioned = await budgetService.tryProvision(db, actor, { budgetId: request.budgetId, requestId: id, amount: request.amount });
    return changeStatus(db, actor, id, request.status, provisioned ? "PROVISIONED" : "AWAITING_BALANCE");
}
