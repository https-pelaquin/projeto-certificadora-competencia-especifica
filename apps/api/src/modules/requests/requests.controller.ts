import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import { idParam } from "../../shared/schemas";
import { cancelRequest } from "./request-cancellation.service";
import { requestComplement } from "./request-complement.service";
import { createRequest } from "./request-creation.service";
import { editRequest } from "./request-edit.service";
import * as queries from "./request-queries.service";
import { requestDetailOut, requestOut } from "./requests.presenter";
import * as requestsSchemas from "./requests.schemas";
import * as requestsService from "./requests.service";

export async function list(req: Request, res: Response) {
    const { page, pageSize, ...filters } = requestsSchemas.listQuery.parse(req.query);
    const result = await queries.listRequests(req.user!, filters, page, pageSize);
    res.json({ ...result, items: result.items.map(requestOut) });
}

export async function get(req: Request, res: Response) {
    const detail = await queries.getRequest(req.user!, idParam.parse(req.params.id));
    res.json(requestDetailOut(detail));
}

export async function create(req: Request, res: Response) {
    const body = requestsSchemas.createBody.parse(req.body);
    const created = await createRequest(actorFrom(req), body);
    res.status(201).json(requestDetailOut(await queries.getRequest(req.user!, created.id)));
}

export async function edit(req: Request, res: Response) {
    const body = requestsSchemas.editBody.parse(req.body);
    const id = idParam.parse(req.params.id);
    await editRequest(actorFrom(req), id, body);
    res.json(requestDetailOut(await queries.getRequest(req.user!, id)));
}

export async function cancel(req: Request, res: Response) {
    const body = requestsSchemas.cancelBody.parse(req.body ?? {});
    const id = idParam.parse(req.params.id);
    await cancelRequest(actorFrom(req), req.user!, id, body);
    res.json(requestDetailOut(await queries.getRequest(req.user!, id)));
}

export async function provision(req: Request, res: Response) {
    const id = idParam.parse(req.params.id);
    await requestsService.provisionRequest(actorFrom(req), id);
    res.json(requestDetailOut(await queries.getRequest(req.user!, id)));
}

export async function complement(req: Request, res: Response) {
    const body = requestsSchemas.complementBody.parse(req.body);
    const { complement, status } = await requestComplement(actorFrom(req), idParam.parse(req.params.id), body);
    res.status(201).json({ id: complement.id, message: complement.message, createdAt: complement.createdAt, requestStatus: status });
}
