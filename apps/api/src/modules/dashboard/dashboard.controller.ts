import type { Request, Response } from "express";
import * as dashboardSchemas from "./dashboard.schemas";
import * as dashboardService from "./dashboard.service";
import { dateBrasilia } from "../../shared/dates";

export async function get(req: Request, res: Response) {
    const { year } = dashboardSchemas.query.parse(req.query);
    res.json(await dashboardService.getDashboard(year ?? dateBrasilia(new Date())));
}
