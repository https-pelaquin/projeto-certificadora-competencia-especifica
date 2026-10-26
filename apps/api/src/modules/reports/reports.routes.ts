import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as reportsController from "./reports.controller";

export function createReportsRouter() {
    const router = Router();
    router.get("/reports/annual/:year.pdf", authenticate, requirePermission("reports:read"), reportsController.annual);
    return router;
}
