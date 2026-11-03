import type { Prisma } from "../../generated/prisma/client";

// Dinheiro sai da API como texto com 2 casas ("1000.00"), nunca como número.
export const moneyOut = (value: Prisma.Decimal) => value.toFixed(2);

export function balanceOut(balance: { total: Prisma.Decimal; available: Prisma.Decimal; provisioned: Prisma.Decimal; spent: Prisma.Decimal }) {
    return {
        total: moneyOut(balance.total),
        available: moneyOut(balance.available),
        provisioned: moneyOut(balance.provisioned),
        spent: moneyOut(balance.spent),
    };
}
