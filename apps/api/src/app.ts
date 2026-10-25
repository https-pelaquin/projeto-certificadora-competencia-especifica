import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestContext } from "./middlewares/requestContext";
import { requireJson } from "./middlewares/requireJson";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { prisma } from "./shared/prisma";
import { createSessionMiddleware } from "./shared/session";

export function createApp() {
    const app = express();

    if (env.NODE_ENV === "production") {
        app.set("trust proxy", 1); // cookie Secure atrás do proxy reverso
    }
    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
    app.use(requestContext);
    app.use(express.json({ limit: "100kb" }));
    app.use(requireJson);
    app.use(createSessionMiddleware());

    app.get("/api/health", async (_req, res) => {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok" });
    });

    app.use("/api", createAuthRouter());

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
