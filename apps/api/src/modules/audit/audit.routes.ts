import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as auditController from "./audit.controller";

export function createAuditRouter() {
    const router = Router();
    router.get("/audit-logs", authenticate, requirePermission("audit:read"), auditController.list);
    return router;
}
