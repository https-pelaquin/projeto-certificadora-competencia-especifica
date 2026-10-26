import type { Request, Response } from "express";
import * as auditSchemas from "./audit.schemas";
import * as auditService from "./audit.service";

export async function list(req: Request, res: Response) {
    const { page, pageSize, ...filters } = auditSchemas.listQuery.parse(req.query);
    res.json(await auditService.listAuditLogs(filters, page, pageSize));
}
