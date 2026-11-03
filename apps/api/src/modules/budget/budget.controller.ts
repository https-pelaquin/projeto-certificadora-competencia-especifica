import type { Request, Response } from "express";
import type { Prisma } from "../../../generated/prisma/client";
import { actorFrom } from "../../middlewares/authenticate";
import { balanceOut, moneyOut } from "../../shared/money";
import { idParam } from "../../shared/schemas";
import * as approvalLimitService from "./approval-limit.service";
import * as budgetSchemas from "./budget.schemas";
import * as budgetService from "./budget.service";

const budgetOut = (budget: { id: number; year: number; initialAmount: Prisma.Decimal; createdAt: Date }) => ({
    id: budget.id,
    year: budget.year,
    initialAmount: moneyOut(budget.initialAmount),
    createdAt: budget.createdAt,
});

const limitOut = (limit: { id: number; amount: Prisma.Decimal; periodMonths: number; validFrom: Date; validUntil: Date | null }) => ({
    id: limit.id,
    amount: moneyOut(limit.amount),
    periodMonths: limit.periodMonths,
    validFrom: limit.validFrom,
    validUntil: limit.validUntil,
});

export async function list(_req: Request, res: Response) {
    const budgets = await budgetService.listBudgets();
    res.json(budgets.map(({ budget, balance }) => ({ ...budgetOut(budget), balance: balanceOut(balance) })));
}

export async function get(req: Request, res: Response) {
    const { budget, balance } = await budgetService.getBudgetDetail(idParam.parse(req.params.id));
    res.json({ ...budgetOut(budget), balance: balanceOut(balance) });
}

export async function create(req: Request, res: Response) {
    const body = budgetSchemas.createBody.parse(req.body);
    const created = await budgetService.createBudget(actorFrom(req), { year: body.year, initialAmount: body.initialAmount });
    const { budget, balance } = await budgetService.getBudgetDetail(created.id);
    res.status(201).json({ ...budgetOut(budget), balance: balanceOut(balance) });
}

export async function adjust(req: Request, res: Response) {
    const body = budgetSchemas.adjustBody.parse(req.body);
    const balance = await budgetService.adjustBudget(actorFrom(req), idParam.parse(req.params.id), body);
    res.status(201).json({ balance: balanceOut(balance) });
}

export async function ledger(req: Request, res: Response) {
    const { page, pageSize } = budgetSchemas.ledgerQuery.parse(req.query);
    const result = await budgetService.listLedger(idParam.parse(req.params.id), page, pageSize);
    res.json({
        ...result,
        items: result.items.map((entry) => ({
            id: entry.id,
            type: entry.type,
            amount: moneyOut(entry.amount),
            requestId: entry.requestId,
            justification: entry.justification,
            createdBy: entry.createdBy,
            createdAt: entry.createdAt,
        })),
    });
}

export async function listLimits(_req: Request, res: Response) {
    res.json((await approvalLimitService.listLimits()).map(limitOut));
}

export async function createLimit(req: Request, res: Response) {
    const body = budgetSchemas.createLimitBody.parse(req.body);
    const limit = await approvalLimitService.createLimit(actorFrom(req), {
        amount: body.amount,
        periodMonths: body.periodMonths,
        validFrom: body.validFrom ?? new Date(),
    });
    res.status(201).json(limitOut(limit));
}
