import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestContext } from "./middlewares/requestContext";
import { requireJson } from "./middlewares/requireJson";
import { prisma } from "./shared/prisma";

export function createApp() {
    const app = express();

    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
    app.use(requestContext);
    app.use(express.json({ limit: "100kb" }));
    app.use(requireJson);

    app.get("/api/health", async (_req, res) => {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok" });
    });

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
