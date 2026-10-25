import { Prisma } from "../../../generated/prisma/client";
import { prisma, type Db } from "../../shared/prisma";
import { actorUserId, type Actor } from "../../shared/actor";
import { BusinessRuleError } from "../../shared/errors";
import { addMonths } from "../../shared/dates";
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
        const current = await approvalLimitRepository.findValidAt(tx, data.validFrom);

        if (current && data.validFrom <= current.validFrom) {
            throw new BusinessRuleError("O novo limite deve começar depois do início do limite vigente");
        }
        if (current) {
            await approvalLimitRepository.end(tx, current.id, data.validFrom);
        }

        return approvalLimitRepository.create(tx, { ...data, createdById: actorUserId(actor) });
    });
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
