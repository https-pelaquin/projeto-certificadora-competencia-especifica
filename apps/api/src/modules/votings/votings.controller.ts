import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import { idParam } from "../../shared/schemas";
import * as votingsSchemas from "./votings.schemas";
import * as votingsService from "./votings.service";

export async function open(req: Request, res: Response) {
    const { deadline } = votingsSchemas.openBody.parse(req.body);
    res.status(201).json(await votingsService.openVoting(actorFrom(req), idParam.parse(req.params.requestId), deadline));
}

export async function list(req: Request, res: Response) {
    const { status } = votingsSchemas.listQuery.parse(req.query);
    res.json(await votingsService.listVotings(req.user!, status));
}

export async function get(req: Request, res: Response) {
    res.json(await votingsService.getVoting(req.user!, idParam.parse(req.params.id)));
}

export async function vote(req: Request, res: Response) {
    const { choice } = votingsSchemas.voteBody.parse(req.body);
    res.status(201).json(await votingsService.castVote(actorFrom(req), idParam.parse(req.params.id), choice));
}

export async function tieBreak(req: Request, res: Response) {
    const { choice } = votingsSchemas.tieBreakBody.parse(req.body);
    res.json(await votingsService.castTieBreak(actorFrom(req), idParam.parse(req.params.id), choice));
}

export async function listComments(req: Request, res: Response) {
    res.json(await votingsService.listComments(req.user!, idParam.parse(req.params.id)));
}

export async function addComment(req: Request, res: Response) {
    const { body } = votingsSchemas.commentBody.parse(req.body);
    res.status(201).json(await votingsService.addComment(actorFrom(req), req.user!, idParam.parse(req.params.id), body));
}
