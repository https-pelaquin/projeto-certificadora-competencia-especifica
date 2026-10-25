import { RequestStatus } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";
import * as requestsRepository from "./requests.repository";

// Todos exceto rejeitadas e canceladas: impede dividir um pedido grande para fugir do conselho. [VALIDAR]
export const STATUSES_COUNTED_IN_LIMIT: RequestStatus[] = [
    "AWAITING_VOTING",
    "AWAITING_COMPLEMENT",
    "AWAITING_BALANCE",
    "IN_VOTING",
    "PROVISIONED",
    "PAID",
];

export function sumAccumulatedByRequester(db: Db, data: { requesterId: number; since: Date; excludeRequestId?: number }) {
    return requestsRepository.sumByRequester(db, { ...data, statuses: STATUSES_COUNTED_IN_LIMIT });
}
