import type { Request, Response } from "express";
import { actorFrom } from "../../middlewares/authenticate";
import { balanceOut, moneyOut } from "../../shared/money";
import { idParam } from "../../shared/schemas";
import * as paymentsSchemas from "./payments.schemas";
import { recordPayment } from "./payments.service";

export async function record(req: Request, res: Response) {
    const body = paymentsSchemas.recordBody.parse(req.body);
    const { payment, balance } = await recordPayment(actorFrom(req), idParam.parse(req.params.id), body);
    res.status(201).json({
        payment: {
            id: payment.id,
            requestId: payment.requestId,
            paidAmount: moneyOut(payment.paidAmount),
            justification: payment.justification,
            paidAt: payment.paidAt,
        },
        balance: balanceOut(balance),
    });
}
