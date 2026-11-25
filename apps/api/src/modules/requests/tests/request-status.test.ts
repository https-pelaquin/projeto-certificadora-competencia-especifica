import { beforeEach, expect, it } from "vitest";
import { ConflictError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { insertRequest, setupFinance, system } from "../../../test/finance";
import { changeStatus } from "../requests.service";

beforeEach(resetDatabase);

async function provisionedRequest() {
    const s = await setupFinance();
    return insertRequest({ requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "100.00", status: "PROVISIONED" });
}

it("muda o status quando o estado de origem confere, e audita", async () => {
    const request = await provisionedRequest();

    const after = await changeStatus(prisma, system, request.id, "PROVISIONED", "CANCELED");

    expect(after.status).toBe("CANCELED");
    expect(await prisma.auditLog.count({ where: { action: "REQUEST_STATUS_CHANGED", entityId: String(request.id) } })).toBe(1);
});

it("recusa se o status no banco não é o esperado: não grava e não audita", async () => {
    const request = await provisionedRequest();

    // quem chama achava que estava PAID, mas no banco está PROVISIONED
    await expect(changeStatus(prisma, system, request.id, "PAID", "CANCELED")).rejects.toThrow(ConflictError);

    expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PROVISIONED");
    expect(await prisma.auditLog.count({ where: { action: "REQUEST_STATUS_CHANGED" } })).toBe(0);
});
