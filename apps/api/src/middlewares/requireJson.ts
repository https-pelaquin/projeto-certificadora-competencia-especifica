import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasBody(req: Request) {
    return req.headers["transfer-encoding"] !== undefined || Number(req.headers["content-length"] ?? 0) > 0;
}

// Proteção CSRF: formulários HTML não enviam application/json sem preflight de CORS.
// Requisição sem corpo e sem Content-Type (ex.: logout) é aceita; o cookie SameSite=Lax cobre esse caso.
export function requireJson(req: Request, _res: Response, next: NextFunction) {
    const contentType = req.headers["content-type"];
    const mustBeJson = MUTATING.has(req.method) && (contentType !== undefined || hasBody(req));

    if (mustBeJson && !/^application\/json\b/i.test(contentType ?? "")) {
        return next(new AppError("A API aceita apenas application/json", 415, "UNSUPPORTED_MEDIA_TYPE"));
    }
    next();
}
