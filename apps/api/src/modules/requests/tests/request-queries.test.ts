import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createUser } from "../../../test/factories";
import { authUser, insertRequest, setupFinance } from "../../../test/finance";
import { getRequest } from "../request-queries.service";

beforeEach(resetDatabase);

// Uma solicitação em votação, com um conselheiro convocado e outro que não foi.
async function scenario(votingStatus: "OPEN" | "CLOSED" = "OPEN") {
    const s = await setupFinance();
    const convened = await createUser({ roles: ["COUNCIL_MEMBER"] });
    const notConvened = await createUser({ roles: ["COUNCIL_MEMBER"] });
    const otherProfessor = await createUser({ roles: ["PROFESSOR"] });
    const request = await insertRequest({
        requesterId: s.requester.id, budgetId: s.budget.id, categoryId: s.category.id, limitId: s.limit.id, amount: "100.00", status: "IN_VOTING",
    });
    await prisma.voting.create({
        data: {
            requestId: request.id,
            openedById: s.head.id,
            deadline: new Date(Date.now() + 60 * 60_000),
            status: votingStatus,
            eligibleMembers: { create: [{ userId: convened.id }] },
        },
    });
    return { s, request, convened, notConvened, otherProfessor };
}

describe("detalhe da solicitação: quem pode ver", () => {
    it("o conselheiro convocado vê", async () => {
        const { request, convened } = await scenario();
        const detail = await getRequest(authUser(convened, ["COUNCIL_MEMBER"]), request.id);
        expect(detail.request.id).toBe(request.id);
    });

    it("o convocado continua vendo depois que a votação encerra", async () => {
        const { request, convened } = await scenario("CLOSED");
        expect((await getRequest(authUser(convened, ["COUNCIL_MEMBER"]), request.id)).request.id).toBe(request.id);
    });

    it("conselheiro que não foi convocado recebe 404", async () => {
        const { request, notConvened } = await scenario();
        await expect(getRequest(authUser(notConvened, ["COUNCIL_MEMBER"]), request.id)).rejects.toThrow(NotFoundError);
    });

    it("outro professor recebe 404", async () => {
        const { request, otherProfessor } = await scenario();
        await expect(getRequest(authUser(otherProfessor, ["PROFESSOR"]), request.id)).rejects.toThrow(NotFoundError);
    });

    it("o dono e o chefe continuam vendo", async () => {
        const { s, request } = await scenario();
        expect((await getRequest(authUser(s.requester, ["PROFESSOR"]), request.id)).request.id).toBe(request.id);
        expect((await getRequest(authUser(s.head, ["HEAD"]), request.id)).request.id).toBe(request.id);
    });

    it("solicitação que não existe dá 404, inclusive para o convocado", async () => {
        const { convened } = await scenario();
        await expect(getRequest(authUser(convened, ["COUNCIL_MEMBER"]), 999999)).rejects.toThrow(NotFoundError);
    });
});
