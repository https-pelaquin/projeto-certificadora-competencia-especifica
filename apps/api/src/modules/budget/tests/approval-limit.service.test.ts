import { beforeEach, expect, it } from "vitest";
import { Prisma } from "../../../../generated/prisma/client";
import { BusinessRuleError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createLimit } from "../approval-limit.service";

const D = (v: string) => new Prisma.Decimal(v);
const system = { type: "SYSTEM", job: "test" } as const;

beforeEach(resetDatabase);

it("cadastra um limite", async () => {
    const limit = await createLimit(system, { amount: D("1000.00"), periodMonths: 12, validFrom: new Date() });
    expect(limit.amount).toEqual(D("1000.00"));
    expect(limit.periodMonths).toBe(12);
});

it("recusa limite com valor menor ou igual a zero", async () => {
    await expect(createLimit(system, { amount: D("0.00"), periodMonths: 12, validFrom: new Date() }))
        .rejects.toThrow(BusinessRuleError);
});

it("recusa período menor que 1 mês", async () => {
    await expect(createLimit(system, { amount: D("200.00"), periodMonths: 0, validFrom: new Date() }))
        .rejects.toThrow(BusinessRuleError);
});

it("recusa limite que começa na mesma data do último cadastrado", async () => {
    const now = new Date();
    await createLimit(system, { amount: D("1000.00"), periodMonths: 12, validFrom: now });
    await expect(createLimit(system, { amount: D("2000.00"), periodMonths: 7, validFrom: now }))
        .rejects.toThrow("O novo limite deve começar depois do início do último limite cadastrado");
});

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
// "Hoje" fixo dos testes de vigência: todos os limites abaixo começam nesse dia ou depois.
const NOW = day("2026-01-01");

async function limitsInOrder() {
    return prisma.approvalLimit.findMany({ orderBy: { validFrom: "asc" } });
}

it("encerra o limite anterior na data do novo, e o novo nasce sem fim", async () => {
    await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") });
    await createLimit(system, { amount: D("3000.00"), periodMonths: 6, validFrom: day("2026-06-01") }, NOW);

    const [first, second] = await limitsInOrder();
    expect(first.validUntil).toEqual(day("2026-06-01"));
    expect(second.validUntil).toBeNull();
});

it("recusa início anterior ao do limite mais recente, mesmo dentro do período de um limite antigo", async () => {
    await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") });
    await createLimit(system, { amount: D("3000.00"), periodMonths: 6, validFrom: day("2026-06-01") }, NOW);

    await expect(createLimit(system, { amount: D("9999.00"), periodMonths: 6, validFrom: day("2026-03-01") }, NOW))
        .rejects.toThrow(BusinessRuleError);

    // nada foi reescrito: o primeiro continua terminando em 1º de junho e só existe um limite sem fim
    const all = await limitsInOrder();
    expect(all).toHaveLength(2);
    expect(all[0].validUntil).toEqual(day("2026-06-01"));
    expect(all.filter((l) => l.validUntil === null)).toHaveLength(1);
});

it("o banco recusa períodos de limite sobrepostos", async () => {
    await prisma.approvalLimit.create({
        data: { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01"), validUntil: day("2026-06-01") },
    });
    await expect(prisma.approvalLimit.create({
        data: { amount: D("2000.00"), periodMonths: 6, validFrom: day("2026-03-01") },
    })).rejects.toThrow();
});

it("o banco recusa limite que termina antes de começar", async () => {
    await expect(prisma.approvalLimit.create({
        data: { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-06-01"), validUntil: day("2026-01-01") },
    })).rejects.toThrow();
});

it("o cadastro espera outro cadastro de limite em andamento", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const gotLock = new Promise<void>((resolve) => (locked = resolve));

    // Simula outro cadastro no meio da transação, segurando o lock dos limites.
    const other = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ApprovalLimit'))`;
        locked();
        await hold;
    });
    await gotLock;

    let settled = false;
    const creating = createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") })
        .finally(() => (settled = true));

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(settled).toBe(false);

    release();
    await other;
    await creating;
    expect(settled).toBe(true);
});

it("cadastros simultâneos nunca deixam dois limites sem fim", async () => {
    await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") });

    const results = await Promise.allSettled([
        createLimit(system, { amount: D("2000.00"), periodMonths: 6, validFrom: day("2026-02-01") }, NOW),
        createLimit(system, { amount: D("3000.00"), periodMonths: 6, validFrom: day("2026-03-01") }, NOW),
    ]);

    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
        if (r.status === "rejected") expect(r.reason).toBeInstanceOf(BusinessRuleError);
    }
    expect((await limitsInOrder()).filter((l) => l.validUntil === null)).toHaveLength(1);
});

it("recusa limite que começa no passado quando já existe um anterior, e não reescreve nada", async () => {
    await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") });
    const now = day("2026-11-25");

    await expect(createLimit(system, { amount: D("2000.00"), periodMonths: 6, validFrom: day("2026-11-24") }, now))
        .rejects.toThrow("não pode começar no passado");

    const all = await limitsInOrder();
    expect(all).toHaveLength(1);
    expect(all[0].validUntil).toBeNull();
});

it("aceita começar hoje à meia-noite de Brasília, mesmo já tendo passado", async () => {
    await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2026-01-01") });
    const now = new Date("2026-11-25T15:00:00Z");
    const todayMidnightBrasilia = new Date("2026-11-25T03:00:00Z");

    await createLimit(system, { amount: D("2000.00"), periodMonths: 6, validFrom: todayMidnightBrasilia }, now);
    expect(await limitsInOrder()).toHaveLength(2);

    // um segundo antes da meia-noite de Brasília ainda é "ontem"
    await expect(createLimit(system, { amount: D("3000.00"), periodMonths: 6, validFrom: new Date("2026-11-25T02:59:59Z") }, now))
        .rejects.toThrow(BusinessRuleError);
});

it("o primeiro limite pode começar no passado", async () => {
    const limit = await createLimit(system, { amount: D("1000.00"), periodMonths: 6, validFrom: day("2020-01-01") }, day("2026-11-25"));
    expect(limit.validFrom).toEqual(day("2020-01-01"));
});
