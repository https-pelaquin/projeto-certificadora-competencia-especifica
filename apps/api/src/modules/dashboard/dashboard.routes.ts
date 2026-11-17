import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as dashboardController from "./dashboard.controller";

export function createDashboardRouter() {
    const router = Router();

    router.get("/dashboard", authenticate, requirePermission("dashboard:read"), dashboardController.get);

    return router;
}
