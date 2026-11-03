import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import { idParam } from "../../shared/schemas";
import * as categoriesSchemas from "./categories.schemas";
import * as categoriesService from "./categories.service";

export async function list(req: Request, res: Response) {
    const onlyActive = !req.user!.permissions.has("categories:manage");
    res.json(await categoriesService.listCategories({ onlyActive }));
}

export async function create(req: Request, res: Response) {
    const body = categoriesSchemas.createBody.parse(req.body);
    res.status(201).json(await categoriesService.createCategory(actorFrom(req), body));
}

export async function update(req: Request, res: Response) {
    const body = categoriesSchemas.updateBody.parse(req.body);
    res.json(await categoriesService.updateCategory(actorFrom(req), idParam.parse(req.params.id), body));
}
