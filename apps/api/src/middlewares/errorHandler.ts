import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../shared/errors";
import { log } from "../shared/logger";

export function notFound(_req: Request, res: Response) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Rota não encontrada" } });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
    if (error instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Dados inválidos",
                details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
        });
    }

    if (error instanceof AppError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            return res.status(409).json({ error: { code: "CONFLICT", message: "Registro duplicado" } });
        }
        if (error.code === "P2025") {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Registro não encontrado" } });
        }
    }

    // JSON malformado no corpo (body-parser).
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
        return res.status(400).json({ error: { code: "INVALID_JSON", message: "JSON inválido" } });
    }

    log("error", "unhandled error", {
        requestId: req.requestId,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: `Erro interno. Informe o código ${req.requestId} ao suporte.` },
    });
}
