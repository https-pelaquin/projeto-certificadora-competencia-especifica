import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as votingsController from "./votings.controller";

export function createVotingsRouter() {
    const router = Router();

    router.post("/requests/:requestId/votings", authenticate, requirePermission("votings:open"), votingsController.open);
    // Leitura: o service filtra pelo vínculo do usuário com a votação.
    router.get("/votings", authenticate, votingsController.list);
    router.get("/votings/:id", authenticate, votingsController.get);
    router.post("/votings/:id/votes", authenticate, requirePermission("votings:vote"), votingsController.vote);
    router.post("/votings/:id/tie-break", authenticate, requirePermission("votings:tieBreak"), votingsController.tieBreak);
    router.get("/votings/:id/comments", authenticate, requirePermission("votings:comment"), votingsController.listComments);
    router.post("/votings/:id/comments", authenticate, requirePermission("votings:comment"), votingsController.addComment);

    return router;
}
