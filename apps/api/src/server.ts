import { createApp } from "./app";
import { env } from "./config/env";
import { log } from "./shared/logger";
import { prisma } from "./shared/prisma";

const server = createApp().listen(env.PORT, () => {
    log("info", `API ouvindo na porta ${env.PORT}`);
});

async function shutdown(signal: string) {
    log("info", `encerrando (${signal})`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
