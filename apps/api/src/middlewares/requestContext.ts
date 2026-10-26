import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { log } from "../shared/logger";

export function requestContext(req: Request, res: Response, next: NextFunction) {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);

    const startedAt = performance.now();
    res.on("finish", () => {
        log("info", "request", {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            ms: Math.round(performance.now() - startedAt),
        });
    });

    next();
}
