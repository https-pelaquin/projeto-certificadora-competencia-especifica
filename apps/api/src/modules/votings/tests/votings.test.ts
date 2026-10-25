import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createRequest, createUser, DAY, loginAs } from "../../../test/factories";
import { cancelForRequest, closeExpiredVotings, tallyResult } from "../votings.service";

const app = createApp();
const HOUR = 60 * 60_000;
const inOneHour = () => new Date(Date.now() + HOUR).toISOString();
const afterDeadline = () => new Date(Date.now() + 2 * HOUR);

beforeEach(resetDatabase);

// Chefe, 3 conselheiros, um conselheiro que é o solicitante e uma solicitação aguardando votação.
async function scenario(options: { amount?: string; budget?: string } = {}) {
    const head = await createUser({ roles: ["HEAD", "COUNCIL_MEMBER"] });
    const members = [
        await createUser({ roles: ["COUNCIL_MEMBER"] }),
        await createUser({ roles: ["COUNCIL_MEMBER"] }),
        await createUser({ roles: ["COUNCIL_MEMBER"] }),
    ];
    const requester = await createUser({ roles: ["PROFESSOR", "COUNCIL_MEMBER"] });
    const req = await createRequest({ requesterId: requester.id, ...options });
    const headAgent = await loginAs(app, head);
    return { head, members, requester, req, headAgent };
}

async function openVoting(s: Awaited<ReturnType<typeof scenario>>) {
    const res = await s.headAgent.post(`/api/requests/${s.req.id}/votings`).send({ deadline: inOneHour() });
    expect(res.status).toBe(201);
    return res.body.id as number;
}

async function vote(user: { email: string }, votingId: number, choice: string) {
    return (await loginAs(app, user)).post(`/api/votings/${votingId}/votes`).send({ choice });
}

describe("apuração", () => {
    it("maioria simples; empate e 0×0 vão ao desempate", () => {
        expect(tallyResult({ approve: 2, reject: 1 })).toBe("APPROVED");
        expect(tallyResult({ approve: 1, reject: 2 })).toBe("REJECTED");
        expect(tallyResult({ approve: 1, reject: 1 })).toBe("TIE");
        expect(tallyResult({ approve: 0, reject: 0 })).toBe("TIE");
    });
});

describe("abertura", () => {
    it("convoca conselheiros ativos exceto chefe e solicitante, muda o status e avisa por e-mail", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);

        const eligible = await prisma.votingEligibleMember.findMany({ where: { votingId } });
        expect(eligible.map((e) => e.userId).sort()).toEqual(s.members.map((m) => m.id).sort());
        expect((await prisma.request.findUniqueOrThrow({ where: { id: s.req.id } })).status).toBe("IN_VOTING");
        expect(await prisma.emailOutbox.count({ where: { template: "VOTING_OPENED" } })).toBe(3);
        expect(await prisma.auditLog.count({ where: { action: "VOTING_OPENED" } })).toBe(1);
    });

    it("só o chefe abre; status, prazo e convocados são validados", async () => {
        const s = await scenario();
        const memberAgent = await loginAs(app, s.members[0]!);
        expect((await memberAgent.post(`/api/requests/${s.req.id}/votings`).send({ deadline: inOneHour() })).status).toBe(403);

        const past = new Date(Date.now() - HOUR).toISOString();
        expect((await s.headAgent.post(`/api/requests/${s.req.id}/votings`).send({ deadline: past })).status).toBe(422);
        expect((await s.headAgent.post("/api/requests/9999/votings").send({ deadline: inOneHour() })).status).toBe(404);

        await openVoting(s);
        expect((await s.headAgent.post(`/api/requests/${s.req.id}/votings`).send({ deadline: inOneHour() })).status).toBe(409);
    });

    it("sem conselheiros aptos responde 422", async () => {
        const head = await createUser({ roles: ["HEAD"] });
        const requester = await createUser({ roles: ["COUNCIL_MEMBER"] });
        const req = await createRequest({ requesterId: requester.id });
        const res = await (await loginAs(app, head)).post(`/api/requests/${req.id}/votings`).send({ deadline: inOneHour() });
        expect(res.status).toBe(422);
    });
});

describe("voto", () => {
    it("voto único e imutável; não convocado e solicitante recebem 403", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);

        expect((await vote(s.members[0]!, votingId, "APPROVE")).status).toBe(201);
        expect((await vote(s.members[0]!, votingId, "REJECT")).status).toBe(409);
        expect((await vote(s.requester, votingId, "APPROVE")).status).toBe(403);
        expect((await vote(s.head, votingId, "APPROVE")).status).toBe(403);
        expect((await vote(s.members[1]!, votingId, "TALVEZ")).status).toBe(400);

        const votes = await prisma.vote.findMany({ where: { votingId } });
        expect(votes).toHaveLength(1);
        expect(votes[0]!.choice).toBe("APPROVE");
    });

    it("voto após o prazo responde 422", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await prisma.voting.update({ where: { id: votingId }, data: { deadline: new Date(Date.now() - DAY) } });
        expect((await vote(s.members[0]!, votingId, "APPROVE")).status).toBe(422);
    });
});

describe("encerramento", () => {
    it("aprovada com saldo provisiona uma única vez, mesmo com a rotina rodando duas vezes", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "APPROVE");
        await vote(s.members[1]!, votingId, "APPROVE");
        await vote(s.members[2]!, votingId, "REJECT");

        expect(await closeExpiredVotings(new Date())).toEqual([]);
        expect(await closeExpiredVotings(afterDeadline())).toEqual([{ id: votingId, outcome: "APPROVED" }]);
        expect(await closeExpiredVotings(afterDeadline())).toEqual([]);

        const voting = await prisma.voting.findUniqueOrThrow({ where: { id: votingId } });
        expect(voting).toMatchObject({ status: "CLOSED", result: "APPROVED", approveCount: 2, rejectCount: 1, abstainCount: 0 });
        expect((await prisma.request.findUniqueOrThrow({ where: { id: s.req.id } })).status).toBe("PROVISIONED");
        expect(await prisma.ledgerEntry.count({ where: { requestId: s.req.id, type: "PROVISION" } })).toBe(1);
        // Solicitante + 3 convocados.
        expect(await prisma.emailOutbox.count({ where: { template: "VOTING_CLOSED" } })).toBe(4);
    });

    it("aprovada sem saldo fica aguardando saldo, sem lançamento", async () => {
        const s = await scenario({ amount: "2500.00", budget: "100.00" });
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "APPROVE");
        await closeExpiredVotings(afterDeadline());

        expect((await prisma.request.findUniqueOrThrow({ where: { id: s.req.id } })).status).toBe("AWAITING_BALANCE");
        expect(await prisma.ledgerEntry.count()).toBe(0);
    });

    it("rejeitada muda a solicitação para REJECTED", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "REJECT");
        await vote(s.members[1]!, votingId, "ABSTAIN");
        await closeExpiredVotings(afterDeadline());

        expect((await prisma.request.findUniqueOrThrow({ where: { id: s.req.id } })).status).toBe("REJECTED");
    });
});

describe("desempate", () => {
    it("empate (só abstenções) aguarda o chefe, que decide uma única vez", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "ABSTAIN");

        expect((await s.headAgent.post(`/api/votings/${votingId}/tie-break`).send({ choice: "APPROVE" })).status).toBe(409);

        expect(await closeExpiredVotings(afterDeadline())).toEqual([{ id: votingId, outcome: "TIE" }]);
        expect(await prisma.emailOutbox.count({ where: { template: "VOTING_TIE" } })).toBe(1);

        const memberAgent = await loginAs(app, s.members[0]!);
        expect((await memberAgent.post(`/api/votings/${votingId}/tie-break`).send({ choice: "APPROVE" })).status).toBe(403);

        const res = await s.headAgent.post(`/api/votings/${votingId}/tie-break`).send({ choice: "APPROVE" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "CLOSED", result: "APPROVED" });
        expect((await prisma.request.findUniqueOrThrow({ where: { id: s.req.id } })).status).toBe("PROVISIONED");

        expect((await s.headAgent.post(`/api/votings/${votingId}/tie-break`).send({ choice: "REJECT" })).status).toBe(409);
        expect(await prisma.tieBreak.count()).toBe(1);
    });
});

describe("visibilidade", () => {
    it("convocado vê votos nominais; solicitante só o resultado; professor sem vínculo recebe 403", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "APPROVE");

        const member = await (await loginAs(app, s.members[1]!)).get(`/api/votings/${votingId}`);
        expect(member.body.members.find((m: { id: number }) => m.id === s.members[0]!.id).vote).toBe("APPROVE");
        expect(member.body.canVote).toBe(true);

        const requester = await (await loginAs(app, s.requester)).get(`/api/votings/${votingId}`);
        expect(requester.status).toBe(200);
        expect(requester.body).not.toHaveProperty("members");

        const outsider = await createUser();
        expect((await (await loginAs(app, outsider)).get(`/api/votings/${votingId}`)).status).toBe(403);

        const list = await (await loginAs(app, s.members[0]!)).get("/api/votings?status=OPEN");
        expect(list.body).toHaveLength(1);
        expect(list.body[0]).toMatchObject({ convened: true, myVote: "APPROVE" });
        expect((await (await loginAs(app, outsider)).get("/api/votings")).body).toHaveLength(0);
    });
});

describe("comentários", () => {
    it("convocados e chefe comentam; solicitante não lê nem escreve; encerrada não aceita novos", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        const memberAgent = await loginAs(app, s.members[0]!);

        expect((await memberAgent.post(`/api/votings/${votingId}/comments`).send({ body: "Valor compatível." })).status).toBe(201);
        expect((await s.headAgent.post(`/api/votings/${votingId}/comments`).send({ body: "Ok." })).status).toBe(201);
        expect((await memberAgent.post(`/api/votings/${votingId}/comments`).send({ body: "x".repeat(2001) })).status).toBe(400);

        const requesterAgent = await loginAs(app, s.requester);
        expect((await requesterAgent.get(`/api/votings/${votingId}/comments`)).status).toBe(403);
        expect((await requesterAgent.post(`/api/votings/${votingId}/comments`).send({ body: "Oi" })).status).toBe(403);

        const comments = await memberAgent.get(`/api/votings/${votingId}/comments`);
        expect(comments.body.map((c: { body: string }) => c.body)).toEqual(["Valor compatível.", "Ok."]);

        await vote(s.members[0]!, votingId, "APPROVE");
        await closeExpiredVotings(afterDeadline());
        expect((await memberAgent.post(`/api/votings/${votingId}/comments`).send({ body: "Tarde" })).status).toBe(409);
        expect((await memberAgent.get(`/api/votings/${votingId}/comments`)).body).toHaveLength(2);
    });
});

describe("cancelamento (contrato com requests)", () => {
    it("cancela a votação ativa preservando votos", async () => {
        const s = await scenario();
        const votingId = await openVoting(s);
        await vote(s.members[0]!, votingId, "APPROVE");

        await prisma.$transaction((tx) => cancelForRequest(tx, s.req.id, { type: "SYSTEM", job: "test" }));

        expect((await prisma.voting.findUniqueOrThrow({ where: { id: votingId } })).status).toBe("CANCELED");
        expect(await prisma.vote.count({ where: { votingId } })).toBe(1);
        expect(await closeExpiredVotings(afterDeadline())).toEqual([]);
    });
});

it("sem sessão, rotas de votação respondem 401", async () => {
    expect((await request(app).get("/api/votings")).status).toBe(401);
});
