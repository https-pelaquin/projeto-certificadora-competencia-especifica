import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as requestsController from "./requests.controller";

export function createRequestsRouter() {
    const router = Router();

    // Leitura: o service filtra pelo vínculo do usuário (as próprias, ou todas com `requests:readAll`).
    router.get("/requests", authenticate, requestsController.list);
    router.get("/requests/:id", authenticate, requestsController.get);

    router.post("/requests", authenticate, requirePermission("requests:create"), requestsController.create);
    // Dono da solicitação: o service confere. Cancelar: o dono ou quem tem `requests:cancelAny`.
    router.patch("/requests/:id", authenticate, requirePermission("requests:create"), requestsController.edit);
    router.post("/requests/:id/cancel", authenticate, requestsController.cancel);

    router.post("/requests/:id/provision", authenticate, requirePermission("budget:manage"), requestsController.provision);
    router.post("/requests/:id/complement-requests", authenticate, requirePermission("requests:requestComplement"), requestsController.complement);

    return router;
}
