import { Prisma } from "../../../generated/prisma/client";
import { prisma, type Db } from "../../shared/prisma";
import { actorUserId, type Actor } from "../../shared/actor";
import { BusinessRuleError } from "../../shared/errors";
import { addMonths } from "../../shared/dates";
import * as audit from "../audit/audit.service";
import * as requestsService from "../requests/requests.service";
import * as approvalLimitRepository from "./approval-limit.repository";

export async function createLimit(actor: Actor, data: { amount: Prisma.Decimal; periodMonths: number; validFrom: Date }) {
    if (data.amount.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError("O valor do limite deve ser maior que zero");
    }
    if (data.periodMonths <= 0) {
        throw new BusinessRuleError("O período do limite deve ter pelo menos 1 mês");
    }

    return prisma.$transaction(async (tx) => {
        await approvalLimitRepository.lockWrites(tx);

        // Compara com o limite de início mais recente, e não com o vigente na data nova:
        // senão uma data dentro do período de um limite antigo reescreveria o passado.
        const latest = await approvalLimitRepository.findLatest(tx);

        if (latest && data.validFrom <= latest.validFrom) {
            throw new BusinessRuleError("O novo limite deve começar depois do início do último limite cadastrado");
        }
        if (latest && (latest.validUntil === null || latest.validUntil > data.validFrom)) {
            await approvalLimitRepository.end(tx, latest.id, data.validFrom);
        }

        const limit = await approvalLimitRepository.create(tx, { ...data, createdById: actorUserId(actor) });
        await audit.record(tx, actor, {
            action: "APPROVAL_LIMIT_CREATED",
            entityType: "ApprovalLimit",
            entityId: limit.id,
            before: latest,
            after: limit,
        });
        return limit;
    });
}

export function listLimits() {
    return approvalLimitRepository.list(prisma);
}

// Janela móvel de periodMonths contada a partir de `now`.
export async function checkLimit(db: Db, data: {
    requesterId: number;
    newAmount: Prisma.Decimal;
    now: Date;
    excludeRequestId?: number;
}) {
    const limit = await approvalLimitRepository.findValidAt(db, data.now);
    if (!limit) {
        throw new BusinessRuleError("Não existe limite de aprovação vigente");
    }

    const accumulated = await requestsService.sumAccumulatedByRequester(db, {
        requesterId: data.requesterId,
        since: addMonths(data.now, -limit.periodMonths),
        excludeRequestId: data.excludeRequestId,
    });

    const total = accumulated.plus(data.newAmount);
    const withinLimit = total.lessThanOrEqualTo(limit.amount);

    return {
        withinLimit,
        approvalLimitId: limit.id,
        limit: limit.amount,
        accumulated,
        total,
        remaining: withinLimit ? limit.amount.minus(total) : new Prisma.Decimal(0),
    };
}
