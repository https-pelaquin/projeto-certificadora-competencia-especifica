import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../../middlewares/authenticate";
import { AppError } from "../../shared/errors";
import * as authController from "./auth.controller";

export function createAuthRouter() {
    const router = Router();

    // Só tentativas que falham contam: 10 a cada 15 minutos por IP.
    const loginLimiter = rateLimit({
        windowMs: 15 * 60_000,
        limit: 10,
        skipSuccessfulRequests: true,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (_req, _res, next) => next(new AppError("Muitas tentativas. Tente novamente mais tarde.", 429, "TOO_MANY_REQUESTS")),
    });
    const passwordLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

    router.post("/auth/login", loginLimiter, authController.login);
    router.post("/auth/logout", authController.logout);
    router.get("/auth/me", authenticate, authController.me);
    router.post("/auth/password/forgot", passwordLimiter, authController.forgotPassword);
    router.post("/auth/password/reset", passwordLimiter, authController.resetPassword);

    return router;
}
