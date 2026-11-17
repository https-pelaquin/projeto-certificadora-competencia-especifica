import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as paymentsController from "./payments.controller";

export function createPaymentsRouter() {
    const router = Router();

    router.post("/requests/:id/payment", authenticate, requirePermission("payments:record"), paymentsController.record);

    return router;
}
