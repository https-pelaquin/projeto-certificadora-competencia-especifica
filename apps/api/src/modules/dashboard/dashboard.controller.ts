import type { Request, Response } from "express";
import * as dashboardSchemas from "./dashboard.schemas";
import * as dashboardService from "./dashboard.service";

export async function get(req: Request, res: Response) {
    const { year } = dashboardSchemas.query.parse(req.query);
    res.json(await dashboardService.getDashboard(year ?? new Date().getUTCFullYear()));
}
