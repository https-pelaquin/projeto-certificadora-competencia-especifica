// Cria o primeiro chefe a partir de SEED_HEAD_* (só se ainda não houver usuários).
import { prisma } from "../src/shared/prisma";
import { hashPassword } from "../src/modules/auth/auth.service";
import { addMonths } from "../src/shared/dates";

const { SEED_HEAD_NAME, SEED_HEAD_EMAIL, SEED_HEAD_PASSWORD } = process.env;

async function main() {
    if ((await prisma.user.count()) > 0) {
        console.log("Seed ignorado: já existem usuários.");
        return;
    }
    if (!SEED_HEAD_NAME || !SEED_HEAD_EMAIL || !SEED_HEAD_PASSWORD || SEED_HEAD_PASSWORD.length < 8) {
        throw new Error("Defina SEED_HEAD_NAME, SEED_HEAD_EMAIL e SEED_HEAD_PASSWORD (mín. 8 caracteres) no .env");
    }

    const now = new Date();
    const user = await prisma.user.create({
        data: {
            name: SEED_HEAD_NAME,
            email: SEED_HEAD_EMAIL.trim().toLowerCase(),
            passwordHash: await hashPassword(SEED_HEAD_PASSWORD),
            roleAssignments: {
                create: [
                    { role: "HEAD", startsAt: now, endsAt: addMonths(now, 24) },
                    { role: "PROFESSOR", startsAt: now },
                ],
            },
        },
    });
    await prisma.auditLog.create({
        data: { actorType: "SYSTEM", job: "seed", action: "USER_SEEDED", entityType: "User", entityId: String(user.id) },
    });
    console.log(`Chefe criado: ${user.email}`);
}

main().finally(() => prisma.$disconnect());
