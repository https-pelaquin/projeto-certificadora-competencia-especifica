import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import * as categoriesController from "./categories.controller";

export function createCategoriesRouter() {
    const router = Router();
    const manage = [authenticate, requirePermission("categories:manage")];

    // Leitura para qualquer usuário logado: o formulário de solicitação precisa da lista.
    router.get("/categories", authenticate, categoriesController.list);
    router.post("/categories", ...manage, categoriesController.create);
    router.patch("/categories/:id", ...manage, categoriesController.update);

    return router;
}
