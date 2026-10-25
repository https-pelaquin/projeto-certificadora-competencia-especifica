import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Proteção CSRF: formulários HTML não enviam application/json sem preflight de CORS.
export function requireJson(req: Request, _res: Response, next: NextFunction) {
    if (MUTATING.has(req.method) && !req.is("application/json")) {
        return next(new AppError("A API aceita apenas application/json", 415, "UNSUPPORTED_MEDIA_TYPE"));
    }
    next();
}
