import { beforeEach, expect, it } from "vitest";
import { Prisma } from "../../../../generated/prisma/client";
import { BusinessRuleError, ConflictError } from "../../../shared/errors";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { adjustBudget, createBudget } from "../budget.service";

const D = (v: string) => new Prisma.Decimal(v);
const system = { type: "SYSTEM", job: "test" } as const;
const justification = "Teste";

beforeEach(resetDatabase);

it("ajuste negativo igual ao disponível é aceito", async () => {
    const budget = await createBudget(system, { year: 2026, initialAmount: D("1000.00") });
    const balance = await adjustBudget(system, budget.id, { amount: D("1000.00"), type: "ADJUSTMENT_OUT", justification });
    expect(balance.available).toEqual(D("0.00"));
});

it("ajuste negativo maior que o disponível é rejeitado", async () => {
    const budget = await createBudget(system, { year: 2026, initialAmount: D("1000.00") });
    await expect(adjustBudget(system, budget.id, { amount: D("1000.01"), type: "ADJUSTMENT_OUT", justification }))
        .rejects.toThrow(BusinessRuleError);
});

it("ajuste negativo retorna o saldo correto", async () => {
    const budget = await createBudget(system, { year: 2026, initialAmount: D("1000.00") });
    const balance = await adjustBudget(system, budget.id, { amount: D("500.00"), type: "ADJUSTMENT_OUT", justification });
    expect(balance.available).toEqual(D("500.00"));
});

it("recusa segundo orçamento no mesmo ano", async () => {
    await createBudget(system, { year: 2026, initialAmount: D("1000.00") });
    await expect(createBudget(system, { year: 2026, initialAmount: D("500.00") })).rejects.toThrow(ConflictError);
});

it("o banco recusa UPDATE no ledger", async () => {
    const budget = await createBudget(system, { year: 2026, initialAmount: D("1000.00") });
    await adjustBudget(system, budget.id, { amount: D("10.00"), type: "ADJUSTMENT_IN", justification });
    await expect(prisma.ledgerEntry.updateMany({ data: { amount: D("99.00") } })).rejects.toThrow(/só de inclusão/);
});
