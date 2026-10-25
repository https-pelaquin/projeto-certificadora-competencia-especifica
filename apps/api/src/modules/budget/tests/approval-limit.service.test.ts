import { beforeEach, expect, it } from "vitest";
import { Prisma } from "../../../../generated/prisma/client";
import { BusinessRuleError } from "../../../shared/errors";
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

it("recusa limite que começa antes do início do vigente", async () => {
    const now = new Date();
    await createLimit(system, { amount: D("1000.00"), periodMonths: 12, validFrom: now });
    await expect(createLimit(system, { amount: D("2000.00"), periodMonths: 7, validFrom: now }))
        .rejects.toThrow("O novo limite deve começar depois do início do limite vigente");
});
