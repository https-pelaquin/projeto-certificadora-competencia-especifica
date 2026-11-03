import { Prisma } from "../../../generated/prisma/client";
import type { Actor } from "../../shared/actor";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../shared/errors";
import { prisma, type Db } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as categoriesRepository from "./categories.repository";

const duplicate = (name: string) => new ConflictError(`Já existe uma categoria chamada "${name}"`);

function isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Quem administra vê todas; os demais só as ativas (as que podem ser escolhidas numa solicitação).
export function listCategories(options: { onlyActive: boolean }) {
    return categoriesRepository.list(prisma, options);
}

export async function createCategory(actor: Actor, data: { name: string }) {
    try {
        return await prisma.$transaction(async (tx) => {
            const category = await categoriesRepository.create(tx, data);
            await audit.record(tx, actor, { action: "CATEGORY_CREATED", entityType: "ExpenseCategory", entityId: category.id, after: category });
            return category;
        });
    } catch (error) {
        if (isUniqueViolation(error)) throw duplicate(data.name);
        throw error;
    }
}

// Categoria nunca é apagada: desativar tira das novas solicitações e preserva as antigas.
export async function updateCategory(actor: Actor, id: number, data: { name?: string; active?: boolean }) {
    try {
        return await prisma.$transaction(async (tx) => {
            const before = await categoriesRepository.findById(tx, id);
            if (!before) {
                throw new NotFoundError("Categoria não encontrada");
            }
            const after = await categoriesRepository.update(tx, id, data);
            await audit.record(tx, actor, { action: "CATEGORY_UPDATED", entityType: "ExpenseCategory", entityId: id, before, after });
            return after;
        });
    } catch (error) {
        if (isUniqueViolation(error) && data.name) throw duplicate(data.name);
        throw error;
    }
}

// Usada ao criar ou editar uma solicitação.
export async function requireActive(db: Db, id: number) {
    const category = await categoriesRepository.findById(db, id);
    if (!category) {
        throw new BusinessRuleError("Categoria inválida");
    }
    if (!category.active) {
        throw new BusinessRuleError("Esta categoria está inativa");
    }
    return category;
}
