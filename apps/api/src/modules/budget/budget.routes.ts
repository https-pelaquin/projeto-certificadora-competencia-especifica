import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as budgetController from "./budget.controller";

export function createBudgetRouter() {
    const router = Router();
    const read = [authenticate, requirePermission("budget:read")];
    const manage = [authenticate, requirePermission("budget:manage")];
    const manageLimits = [authenticate, requirePermission("limits:manage")];

    router.get("/budgets", ...read, budgetController.list);
    router.post("/budgets", ...manage, budgetController.create);
    router.get("/budgets/:id", ...read, budgetController.get);
    router.post("/budgets/:id/adjustments", ...manage, budgetController.adjust);
    router.get("/budgets/:id/ledger", ...read, budgetController.ledger);

    router.get("/approval-limits", ...read, budgetController.listLimits);
    router.post("/approval-limits", ...manageLimits, budgetController.createLimit);

    return router;
}
