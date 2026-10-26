import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as usersController from "./users.controller";

export function createUsersRouter() {
    const router = Router();
    const manage = [authenticate, requirePermission("users:manage")];

    router.get("/users", ...manage, usersController.list);
    router.post("/users", ...manage, usersController.invite);
    router.get("/users/:id", ...manage, usersController.get);
    router.patch("/users/:id", ...manage, usersController.update);
    router.post("/users/:id/invite", ...manage, usersController.resendInvite);
    router.post("/users/:id/roles", ...manage, usersController.assignRole);
    router.post("/users/:id/roles/:assignmentId/end", ...manage, usersController.endRole);

    return router;
}
