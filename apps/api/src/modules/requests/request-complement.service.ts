import type { RequestStatus } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import { notifyComplementRequested } from "./request-notifications";
import * as requestsRepository from "./requests.repository";
import * as requestsService from "./requests.service";

type UserActor = Actor & { type: "USER" };

// O chefe pede mais informações (a permissão `requests:requestComplement` é checada na rota).
//   AWAITING_VOTING ──► AWAITING_COMPLEMENT, e o solicitante edita para voltar à avaliação.
//   IN_VOTING       ──► o status não muda e o valor continua travado; o solicitante edita só o texto.
export async function requestComplement(actor: UserActor, requestId: number, data: { message: string }) {
    const message = data.message.trim();
    if (!message) {
        throw new BusinessRuleError("Informe o que precisa ser complementado");
    }
    if (message.length > 2000) {
        throw new BusinessRuleError("A mensagem pode ter no máximo 2.000 caracteres");
    }

    return prisma.$transaction(async (tx) => {
        const request = await requestsService.getLocked(tx, requestId);
        if (request.status !== "AWAITING_VOTING" && request.status !== "IN_VOTING") {
            throw new ConflictError("A complementação só pode ser pedida antes ou durante a votação");
        }

        const complement = await requestsRepository.createComplement(tx, { requestId, requestedById: actor.userId, message });
        await audit.record(tx, actor, { action: "COMPLEMENT_REQUESTED", entityType: "Request", entityId: requestId, after: complement });

        let status: RequestStatus = request.status;
        if (request.status === "AWAITING_VOTING") {
            status = (await requestsService.changeStatus(tx, actor, requestId, request.status, "AWAITING_COMPLEMENT")).status;
        }
        await notifyComplementRequested(tx, request, complement);

        return { complement, status };
    });
}
