import type { Prisma, RequestStatus } from "../../../generated/prisma/client";
import { NotFoundError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import type { AuthUser } from "../../types/express";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import * as requestsRepository from "./requests.repository";

export type RequestFilters = {
    status?: RequestStatus;
    categoryId?: number;
    requesterId?: number;
    from?: Date;
    to?: Date;
};

// Quem tem `requests:readAll` (chefe, responsável financeiro) vê todas; os demais, só as próprias.
// O filtro por solicitante só vale para quem lê tudo, senão daria para espiar as dos outros.
export async function listRequests(user: AuthUser, filters: RequestFilters, page: number, pageSize: number) {
    const canReadAll = user.permissions.has("requests:readAll");
    const where: Prisma.RequestWhereInput = {
        requesterId: canReadAll ? filters.requesterId : user.id,
        status: filters.status,
        categoryId: filters.categoryId,
        createdAt: { gte: filters.from, lt: filters.to },
    };

    const [items, total] = await Promise.all([
        requestsRepository.list(prisma, where, { skip: (page - 1) * pageSize, take: pageSize }),
        requestsRepository.count(prisma, where),
    ]);
    return { items, page, pageSize, total };
}

// Solicitação que o usuário não pode ver responde 404, igual a uma que não existe.
// Traz só o que é da solicitação: votos e comentários do conselho ficam no módulo de votações.
export async function getRequest(user: AuthUser, id: number) {
    const request = await requestsRepository.findDetailed(prisma, id);
    if (!request || (request.requesterId !== user.id && !user.permissions.has("requests:readAll"))) {
        throw new NotFoundError("Solicitação não encontrada");
    }

    const provisioned = await budgetService.getRequestProvisioned(prisma, id);
    const history = await audit.listAuditLogs({ entityType: "Request", entityId: String(id) }, 1, 100);

    return { request, provisioned, history: [...history.items].reverse() };
}
