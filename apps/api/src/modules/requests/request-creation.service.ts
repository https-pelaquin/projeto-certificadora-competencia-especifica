import type { Prisma } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, NotFoundError } from "../../shared/errors";
import { prisma, type Db } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import * as categoriesService from "../categories/categories.service";
import { evaluateRequest } from "./request-evaluation";
import { notifyProvisioned } from "./request-notifications";
import * as requestsRepository from "./requests.repository";

type UserActor = Actor & { type: "USER" };

// A solicitação pertence ao orçamento do ano em que foi criada.
async function budgetIdOfYear(db: Db, now: Date) {
    const year = now.getUTCFullYear();
    const budget = await budgetService.findBudgetByYear(db, year);
    if (!budget) {
        throw new NotFoundError(`Não há orçamento cadastrado para ${year}`);
    }
    return budget.id;
}

// Cria a solicitação e já a avalia (ver evaluateRequest), tudo sob o lock do orçamento.
// Sem `budgetId`, usa o orçamento do ano de `now`, que também é parâmetro para os testes controlarem o relógio.
export async function createRequest(
    actor: UserActor,
    data: { categoryId: number; budgetId?: number; description: string; amount: Prisma.Decimal },
    now = new Date(),
) {
    const description = data.description.trim();
    if (data.amount.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError("O valor da solicitação deve ser maior que zero");
    }
    if (!description) {
        throw new BusinessRuleError("Informe a descrição da solicitação");
    }

    return prisma.$transaction(async (tx) => {
        const budgetId = data.budgetId ?? (await budgetIdOfYear(tx, now));
        await budgetService.lockBudget(tx, budgetId);
        await categoriesService.requireActive(tx, data.categoryId);

        const { status, approvalLimitId } = await evaluateRequest(tx, {
            requesterId: actor.userId,
            budgetId,
            amount: data.amount,
            now,
        });

        const request = await requestsRepository.create(tx, {
            requesterId: actor.userId,
            categoryId: data.categoryId,
            budgetId,
            approvalLimitId,
            description,
            amount: data.amount,
            status,
        });

        if (status === "PROVISIONED") {
            const provisioned = await budgetService.tryProvision(tx, actor, { budgetId, requestId: request.id, amount: data.amount });
            if (!provisioned) {
                // Não deveria acontecer: o saldo foi lido sob o lock do orçamento, na mesma transação.
                throw new Error("Saldo mudou durante a avaliação da solicitação");
            }
            await notifyProvisioned(tx, request);
        }

        await audit.record(tx, actor, {
            action: "REQUEST_CREATED",
            entityType: "Request",
            entityId: request.id,
            after: request,
        });
        return request;
    });
}
