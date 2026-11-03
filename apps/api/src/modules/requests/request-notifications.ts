import type { Prisma } from "../../../generated/prisma/client";
import { env } from "../../config/env";
import { moneyOut } from "../../shared/money";
import type { Db } from "../../shared/prisma";
import * as notifications from "../notifications/notifications.service";
import * as usersService from "../users/users.service";

// E-mails ao solicitante sobre o andamento da solicitação. Gravados na fila na mesma transação da ação.
const requestLink = (id: number) => `${env.APP_URL}/solicitacoes/${id}`;

type RequestRef = { id: number; requesterId: number };

async function requesterOf(db: Db, request: RequestRef) {
    return (await usersService.findById(db, request.requesterId))!;
}

export async function notifyProvisioned(db: Db, request: RequestRef & { description: string; amount: Prisma.Decimal }) {
    const user = await requesterOf(db, request);
    await notifications.enqueue(db, {
        template: "REQUEST_PROVISIONED",
        to: user.email,
        dedupeKey: `request-provisioned:${request.id}`,
        data: { name: user.name, requestId: request.id, description: request.description, amount: moneyOut(request.amount), link: requestLink(request.id) },
    });
}

export async function notifyCanceled(db: Db, request: RequestRef, justification?: string) {
    const user = await requesterOf(db, request);
    await notifications.enqueue(db, {
        template: "REQUEST_CANCELED",
        to: user.email,
        dedupeKey: `request-canceled:${request.id}`,
        data: { name: user.name, requestId: request.id, justification: justification ?? null, link: requestLink(request.id) },
    });
}

export async function notifyComplementRequested(db: Db, request: RequestRef, complement: { id: number; message: string }) {
    const user = await requesterOf(db, request);
    await notifications.enqueue(db, {
        template: "COMPLEMENT_REQUESTED",
        to: user.email,
        dedupeKey: `complement-requested:${complement.id}`,
        data: { name: user.name, requestId: request.id, message: complement.message, link: requestLink(request.id) },
    });
}

export async function notifyPaymentRecorded(db: Db, request: RequestRef, payment: { id: number; paidAmount: Prisma.Decimal }) {
    const user = await requesterOf(db, request);
    await notifications.enqueue(db, {
        template: "PAYMENT_RECORDED",
        to: user.email,
        dedupeKey: `payment-recorded:${payment.id}`,
        data: { name: user.name, requestId: request.id, paidAmount: moneyOut(payment.paidAmount), link: requestLink(request.id) },
    });
}
