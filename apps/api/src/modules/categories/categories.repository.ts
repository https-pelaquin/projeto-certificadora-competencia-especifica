import type { Db } from "../../shared/prisma";

export function create(db: Db, data: { name: string }) {
    return db.expenseCategory.create({ data });
}

export function findById(db: Db, id: number) {
    return db.expenseCategory.findUnique({ where: { id } });
}

export function list(db: Db, options: { onlyActive: boolean }) {
    return db.expenseCategory.findMany({
        where: options.onlyActive ? { active: true } : undefined,
        orderBy: { name: "asc" },
    });
}

export function update(db: Db, id: number, data: { name?: string; active?: boolean }) {
    return db.expenseCategory.update({ where: { id }, data });
}
