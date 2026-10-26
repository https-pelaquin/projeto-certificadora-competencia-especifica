import type { Prisma, TieBreakChoice, VoteChoice, VotingStatus } from "../../../generated/prisma/client";
import type { Db } from "../../shared/prisma";

export const ACTIVE_STATUSES: VotingStatus[] = ["OPEN", "AWAITING_TIE_BREAK"];

export function create(db: Db, data: { requestId: number; openedById: number; deadline: Date; openedAt: Date; memberIds: number[] }) {
    return db.voting.create({
        data: {
            requestId: data.requestId,
            openedById: data.openedById,
            deadline: data.deadline,
            openedAt: data.openedAt,
            eligibleMembers: { createMany: { data: data.memberIds.map((userId) => ({ userId })) } },
        },
    });
}

export async function lock(db: Db, id: number, mode: "UPDATE" | "SHARE") {
    const rows = mode === "UPDATE"
        ? await db.$queryRaw<{ id: number }[]>`SELECT id FROM "Voting" WHERE id = ${id} FOR UPDATE`
        : await db.$queryRaw<{ id: number }[]>`SELECT id FROM "Voting" WHERE id = ${id} FOR SHARE`;
    return rows.length > 0;
}

export function findById(db: Db, id: number) {
    return db.voting.findUnique({ where: { id } });
}

export function findDetailed(db: Db, id: number) {
    return db.voting.findUnique({
        where: { id },
        include: {
            request: { select: { id: true, requesterId: true, description: true, amount: true, status: true } },
            eligibleMembers: {
                include: { user: { select: { id: true, name: true } }, vote: { select: { choice: true, createdAt: true } } },
                orderBy: { userId: "asc" },
            },
            tieBreak: { include: { head: { select: { id: true, name: true } } } },
        },
    });
}

export function list(db: Db, where: Prisma.VotingWhereInput, userId: number) {
    return db.voting.findMany({
        where,
        include: {
            request: { select: { id: true, requesterId: true, description: true, amount: true } },
            eligibleMembers: { where: { userId }, include: { vote: { select: { choice: true } } } },
        },
        orderBy: { id: "desc" },
    });
}

export function findExpiredOpen(db: Db, now: Date) {
    return db.voting.findMany({
        where: { status: "OPEN", deadline: { lte: now } },
        select: { id: true, requestId: true },
        orderBy: { deadline: "asc" },
    });
}

// SKIP LOCKED: outra instância (ou um voto em andamento) já está com a votação; tenta de novo no próximo ciclo.
export async function lockExpiredOpen(db: Db, id: number, now: Date) {
    const rows = await db.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Voting"
        WHERE id = ${id} AND status = 'OPEN' AND deadline <= ${now}
        FOR UPDATE SKIP LOCKED
    `;
    return rows.length > 0;
}

export function findActiveByRequest(db: Db, requestId: number) {
    return db.voting.findFirst({ where: { requestId, status: { in: ACTIVE_STATUSES } } });
}

export function isEligible(db: Db, votingId: number, userId: number) {
    return db.votingEligibleMember.findUnique({ where: { votingId_userId: { votingId, userId } } });
}

export function eligibleMembers(db: Db, votingId: number) {
    return db.votingEligibleMember.findMany({ where: { votingId }, include: { user: true } });
}

export function createVote(db: Db, data: { votingId: number; userId: number; choice: VoteChoice; createdAt: Date }) {
    return db.vote.create({ data });
}

export async function countVotes(db: Db, votingId: number) {
    const groups = await db.vote.groupBy({ by: ["choice"], where: { votingId }, _count: { _all: true } });
    const countOf = (choice: VoteChoice) => groups.find((g) => g.choice === choice)?._count._all ?? 0;
    return { approve: countOf("APPROVE"), reject: countOf("REJECT"), abstain: countOf("ABSTAIN") };
}

export function createTieBreak(db: Db, data: { votingId: number; headId: number; choice: TieBreakChoice; createdAt: Date }) {
    return db.tieBreak.create({ data });
}

export function update(db: Db, id: number, data: Prisma.VotingUpdateInput) {
    return db.voting.update({ where: { id }, data });
}

export function listComments(db: Db, votingId: number) {
    return db.votingComment.findMany({
        where: { votingId },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { id: "asc" },
    });
}

export function createComment(db: Db, data: { votingId: number; authorId: number; body: string; createdAt: Date }) {
    return db.votingComment.create({ data, include: { author: { select: { id: true, name: true } } } });
}
