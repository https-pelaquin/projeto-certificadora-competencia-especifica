import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import * as reportsSchemas from "./reports.schemas";
import * as reportsService from "./reports.service";

export async function annual(req: Request, res: Response) {
    const year = reportsSchemas.yearParam.parse(req.params.year);
    const pdf = await reportsService.generateAnnualReport(actorFrom(req), year);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-anual-${year}.pdf"`);
    res.send(Buffer.from(pdf));
}
