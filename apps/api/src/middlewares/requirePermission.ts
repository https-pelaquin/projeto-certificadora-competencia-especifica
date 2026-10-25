import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../shared/errors";
import type { Permission } from "../modules/auth/permissions";

// Usar depois de `authenticate`.
export function requirePermission(...permissions: Permission[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!permissions.every((p) => req.user?.permissions.has(p))) {
            return next(new ForbiddenError("Você não tem permissão para esta ação"));
        }
        next();
    };
}
