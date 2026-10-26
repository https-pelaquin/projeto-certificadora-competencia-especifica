import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import { idParam } from "../../shared/schemas";
import * as usersSchemas from "./users.schemas";
import * as usersService from "./users.service";

export async function list(_req: Request, res: Response) {
    res.json(await usersService.listUsers());
}

export async function get(req: Request, res: Response) {
    res.json(await usersService.getUser(idParam.parse(req.params.id)));
}

export async function invite(req: Request, res: Response) {
    const body = usersSchemas.inviteBody.parse(req.body);
    res.status(201).json(await usersService.inviteUser(actorFrom(req), body));
}

export async function resendInvite(req: Request, res: Response) {
    await usersService.resendInvite(actorFrom(req), idParam.parse(req.params.id));
    res.status(204).end();
}

export async function update(req: Request, res: Response) {
    const body = usersSchemas.updateBody.parse(req.body);
    res.json(await usersService.updateUser(actorFrom(req), idParam.parse(req.params.id), body));
}

export async function assignRole(req: Request, res: Response) {
    const body = usersSchemas.assignRoleBody.parse(req.body);
    res.status(201).json(await usersService.assignRole(actorFrom(req), idParam.parse(req.params.id), body));
}

export async function endRole(req: Request, res: Response) {
    const body = usersSchemas.endRoleBody.parse(req.body);
    const user = await usersService.endRole(actorFrom(req), idParam.parse(req.params.id), idParam.parse(req.params.assignmentId), body);
    res.json(user);
}
