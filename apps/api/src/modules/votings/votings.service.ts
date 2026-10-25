import { Prisma, type TieBreakChoice, type VoteChoice, type VotingResult, type VotingStatus } from "../../../generated/prisma/client";
import { env } from "../../config/env";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { log } from "../../shared/logger";
import { prisma, type Db } from "../../shared/prisma";
import type { AuthUser } from "../../types/express";
import * as audit from "../audit/audit.service";
import * as notifications from "../notifications/notifications.service";
import * as requestsService from "../requests/requests.service";
import * as usersService from "../users/users.service";
import * as votingsRepository from "./votings.repository";

type UserActor = Actor & { type: "USER" };

const CLOSE_JOB: Actor = { type: "SYSTEM", job: "closeExpiredVotings" };

const votingLink = (id: number) => `${env.APP_URL}/votacoes/${id}`;
const requestLink = (id: number) => `${env.APP_URL}/solicitacoes/${id}`;

// Abstenção não conta. Qualquer empate, inclusive 0×0, vai ao desempate do chefe. [VALIDAR]
export function tallyResult(counts: { approve: number; reject: number }): VotingResult | "TIE" {
    if (counts.approve > counts.reject) return "APPROVED";
    if (counts.reject > counts.approve) return "REJECTED";
    return "TIE";
}

function isHead(user: AuthUser) {
    return user.roles.includes("HEAD");
}

// --- Abertura ---

export async function openVoting(actor: UserActor, requestId: number, deadline: Date, now = new Date()) {
    if (deadline <= now) {
        throw new BusinessRuleError("O prazo da votação deve ser no futuro");
    }

    const votingId = await prisma.$transaction(async (tx) => {
        const request = await requestsService.getForVoting(tx, requestId);
        if (request.status !== "AWAITING_VOTING") {
            throw new ConflictError("A solicitação não está aguardando votação");
        }

        // Lista gravada na abertura: conselheiros ativos, exceto o chefe e o solicitante.
        const council = await usersService.findActiveWithRole(tx, "COUNCIL_MEMBER", now);
        const heads = await usersService.findActiveWithRole(tx, "HEAD", now);
        const headIds = new Set(heads.map((h) => h.id));
        const members = council.filter((u) => !headIds.has(u.id) && u.id !== request.requesterId);
        if (members.length === 0) {
            throw new BusinessRuleError("Não há conselheiros aptos a votar esta solicitação");
        }

        const voting = await votingsRepository.create(tx, {
            requestId,
            openedById: actor.userId,
            deadline,
            openedAt: now,
            memberIds: members.map((m) => m.id),
        });
        await requestsService.markInVoting(tx, requestId, actor);
        await audit.record(tx, actor, {
            action: "VOTING_OPENED",
            entityType: "Voting",
            entityId: voting.id,
            after: { ...voting, eligibleMemberIds: members.map((m) => m.id) },
        });
        await notifications.enqueue(tx, ...members.map((m) => ({
            template: "VOTING_OPENED" as const,
            to: m.email,
            dedupeKey: `voting-opened:${voting.id}:${m.id}`,
            data: { name: m.name, requestId, description: request.description, deadline: deadline.toISOString(), link: votingLink(voting.id) },
        })));
        return voting.id;
    });

    return votingsRepository.findById(prisma, votingId);
}

// --- Voto ---

export async function castVote(actor: UserActor, votingId: number, choice: VoteChoice, now = new Date()) {
    try {
        return await prisma.$transaction(async (tx) => {
            // FOR SHARE: votos simultâneos convivem, mas o encerramento espera (ou pula) até terminarem.
            if (!(await votingsRepository.lock(tx, votingId, "SHARE"))) {
                throw new NotFoundError("Votação não encontrada");
            }
            const voting = (await votingsRepository.findById(tx, votingId))!;
            if (!(await votingsRepository.isEligible(tx, votingId, actor.userId))) {
                throw new ForbiddenError("Você não foi convocado para esta votação");
            }
            if (voting.status !== "OPEN") {
                throw new ConflictError("A votação não está aberta");
            }
            if (now >= voting.deadline) {
                throw new BusinessRuleError("O prazo da votação terminou");
            }

            const vote = await votingsRepository.createVote(tx, { votingId, userId: actor.userId, choice, createdAt: now });
            await audit.record(tx, actor, { action: "VOTE_CAST", entityType: "Voting", entityId: votingId, after: { choice } });
            return vote;
        });
    } catch (error) {
        // PK (votingId, userId): o banco garante um voto por conselheiro.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ConflictError("Você já votou nesta votação");
        }
        throw error;
    }
}

// --- Encerramento ---

async function finish(tx: Db, actor: Actor, voting: { id: number; requestId: number }, result: VotingResult, counts: { approve: number; reject: number; abstain: number } | null, now: Date) {
    const after = await votingsRepository.update(tx, voting.id, {
        status: "CLOSED",
        result,
        closedAt: now,
        ...(counts && { approveCount: counts.approve, rejectCount: counts.reject, abstainCount: counts.abstain }),
    });
    await requestsService.applyVotingResult(tx, voting.requestId, result, actor);
    await audit.record(tx, actor, { action: "VOTING_CLOSED", entityType: "Voting", entityId: voting.id, after });

    const request = await requestsService.getForVoting(tx, voting.requestId);
    const requester = (await usersService.findById(tx, request.requesterId))!;
    const members = await votingsRepository.eligibleMembers(tx, voting.id);
    const recipients = [{ user: requester, link: requestLink(request.id) }, ...members.map((m) => ({ user: m.user, link: votingLink(voting.id) }))];

    await notifications.enqueue(tx, ...recipients.map(({ user, link }) => ({
        template: "VOTING_CLOSED" as const,
        to: user.email,
        dedupeKey: `voting-closed:${voting.id}:${user.id}`,
        data: { name: user.name, requestId: request.id, result, link },
    })));
}

async function closeOne(candidate: { id: number; requestId: number }, now: Date) {
    return prisma.$transaction(async (tx) => {
        await requestsService.getForVoting(tx, candidate.requestId);
        if (!(await votingsRepository.lockExpiredOpen(tx, candidate.id, now))) {
            return "skipped" as const;
        }

        const counts = await votingsRepository.countVotes(tx, candidate.id);
        const outcome = tallyResult(counts);

        if (outcome !== "TIE") {
            await finish(tx, CLOSE_JOB, candidate, outcome, counts, now);
            return outcome;
        }

        const after = await votingsRepository.update(tx, candidate.id, {
            status: "AWAITING_TIE_BREAK",
            approveCount: counts.approve,
            rejectCount: counts.reject,
            abstainCount: counts.abstain,
        });
        await audit.record(tx, CLOSE_JOB, { action: "VOTING_TIED", entityType: "Voting", entityId: candidate.id, after });
        const heads = await usersService.findActiveWithRole(tx, "HEAD", now);
        await notifications.enqueue(tx, ...heads.map((h) => ({
            template: "VOTING_TIE" as const,
            to: h.email,
            dedupeKey: `voting-tie:${candidate.id}:${h.id}`,
            data: { name: h.name, requestId: candidate.requestId, link: votingLink(candidate.id) },
        })));
        return "TIE" as const;
    });
}

// Rotina agendada. Idempotente: o status muda na mesma transação, então rodar duas vezes não provisiona duas vezes.
export async function closeExpiredVotings(now = new Date()) {
    const candidates = await votingsRepository.findExpiredOpen(prisma, now);
    const results: { id: number; outcome: string }[] = [];

    for (const candidate of candidates) {
        try {
            results.push({ id: candidate.id, outcome: await closeOne(candidate, now) });
        } catch (error) {
            // Uma votação com problema não impede as outras; tenta de novo no próximo ciclo.
            log("error", "falha ao encerrar votação", { votingId: candidate.id, error: error instanceof Error ? error.message : String(error) });
            results.push({ id: candidate.id, outcome: "error" });
        }
    }
    return results;
}

// --- Desempate ---

export async function castTieBreak(actor: UserActor, votingId: number, choice: TieBreakChoice, now = new Date()) {
    await prisma.$transaction(async (tx) => {
        const voting = await votingsRepository.findById(tx, votingId);
        if (!voting) {
            throw new NotFoundError("Votação não encontrada");
        }
        await requestsService.getForVoting(tx, voting.requestId);
        await votingsRepository.lock(tx, votingId, "UPDATE");

        const current = (await votingsRepository.findById(tx, votingId))!;
        if (current.status !== "AWAITING_TIE_BREAK") {
            throw new ConflictError("A votação não aguarda desempate");
        }

        await votingsRepository.createTieBreak(tx, { votingId, headId: actor.userId, choice, createdAt: now });
        await audit.record(tx, actor, { action: "TIE_BREAK_CAST", entityType: "Voting", entityId: votingId, after: { choice } });
        await finish(tx, actor, current, choice === "APPROVE" ? "APPROVED" : "REJECTED", null, now);
    });

    return votingsRepository.findById(prisma, votingId);
}

// --- Cancelamento (contrato para o módulo requests, Pessoa 1) ---

// Chamar com a solicitação já travada (requests.getForVoting). Votos e comentários são preservados.
export async function cancelForRequest(db: Db, requestId: number, actor: Actor, now = new Date()) {
    const voting = await votingsRepository.findActiveByRequest(db, requestId);
    if (!voting) {
        return null;
    }
    await votingsRepository.lock(db, voting.id, "UPDATE");
    const after = await votingsRepository.update(db, voting.id, { status: "CANCELED", closedAt: now });
    await audit.record(db, actor, { action: "VOTING_CANCELED", entityType: "Voting", entityId: voting.id, before: voting, after });
    return after;
}

// --- Consulta ---

// Convocados e chefe veem tudo (voto nominal); solicitante e leitura geral veem só o resultado. [VALIDAR]
export async function getVoting(user: AuthUser, votingId: number) {
    const voting = await votingsRepository.findDetailed(prisma, votingId);
    if (!voting) {
        throw new NotFoundError("Votação não encontrada");
    }

    const isRequester = voting.request.requesterId === user.id;
    const isMember = voting.eligibleMembers.some((m) => m.userId === user.id);
    const summary = {
        id: voting.id,
        request: voting.request,
        status: voting.status,
        result: voting.result,
        openedAt: voting.openedAt,
        deadline: voting.deadline,
        closedAt: voting.closedAt,
    };

    if (!isRequester && (isMember || isHead(user))) {
        return {
            ...summary,
            counts: voting.approveCount === null ? null : {
                approve: voting.approveCount,
                reject: voting.rejectCount,
                abstain: voting.abstainCount,
            },
            members: voting.eligibleMembers.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                vote: m.vote?.choice ?? null,
                votedAt: m.vote?.createdAt ?? null,
            })),
            tieBreak: voting.tieBreak && { head: voting.tieBreak.head, choice: voting.tieBreak.choice, createdAt: voting.tieBreak.createdAt },
            canVote: isMember && voting.status === "OPEN" && !voting.eligibleMembers.find((m) => m.userId === user.id)?.vote,
        };
    }
    if (isRequester || user.permissions.has("requests:readAll")) {
        return summary;
    }
    throw new ForbiddenError("Você não tem acesso a esta votação");
}

export async function listVotings(user: AuthUser, status?: VotingStatus) {
    const seesAll = isHead(user) || user.permissions.has("requests:readAll");
    const where: Prisma.VotingWhereInput = {
        ...(status && { status }),
        ...(!seesAll && { OR: [{ eligibleMembers: { some: { userId: user.id } } }, { request: { requesterId: user.id } }] }),
    };

    const votings = await votingsRepository.list(prisma, where, user.id);
    return votings.map((v) => ({
        id: v.id,
        request: v.request,
        status: v.status,
        result: v.result,
        openedAt: v.openedAt,
        deadline: v.deadline,
        closedAt: v.closedAt,
        convened: v.eligibleMembers.length > 0,
        myVote: v.eligibleMembers[0]?.vote?.choice ?? null,
    }));
}

// --- Comentários ---

// Só convocados e chefe vigente; nunca o solicitante.
async function assertCanComment(db: Db, user: AuthUser, votingId: number) {
    const voting = await votingsRepository.findDetailed(db, votingId);
    if (!voting) {
        throw new NotFoundError("Votação não encontrada");
    }
    const isMember = voting.eligibleMembers.some((m) => m.userId === user.id);
    if (voting.request.requesterId === user.id || !(isMember || isHead(user))) {
        throw new ForbiddenError("Comentários restritos aos conselheiros convocados e ao chefe");
    }
    return voting;
}

export async function listComments(user: AuthUser, votingId: number) {
    await assertCanComment(prisma, user, votingId);
    return votingsRepository.listComments(prisma, votingId);
}

export async function addComment(actor: UserActor, user: AuthUser, votingId: number, body: string, now = new Date()) {
    return prisma.$transaction(async (tx) => {
        const voting = await assertCanComment(tx, user, votingId);
        if (!votingsRepository.ACTIVE_STATUSES.includes(voting.status)) {
            throw new ConflictError("A votação está encerrada para comentários");
        }
        const comment = await votingsRepository.createComment(tx, { votingId, authorId: user.id, body, createdAt: now });
        await audit.record(tx, actor, { action: "VOTING_COMMENT_ADDED", entityType: "Voting", entityId: votingId, after: { commentId: comment.id } });
        return comment;
    });
}
