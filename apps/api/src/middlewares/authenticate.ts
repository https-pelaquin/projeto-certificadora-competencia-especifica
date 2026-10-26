import type { NextFunction, Request, Response } from "express";
import type { Actor } from "../shared/actor";
import { UnauthorizedError } from "../shared/errors";
import { prisma } from "../shared/prisma";
import { permissionsFor } from "../modules/auth/permissions";
import * as usersService from "../modules/users/users.service";

// Usuário e perfis vigentes vêm do banco a cada requisição: desativação e fim de mandato valem na hora.
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
    const userId = req.session.userId;
    if (!userId) {
        throw new UnauthorizedError();
    }

    const user = await usersService.findActiveWithCurrentRoles(prisma, userId, new Date());
    if (!user) {
        await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
        throw new UnauthorizedError("Sessão encerrada");
    }

    req.user = { ...user, permissions: permissionsFor(user.roles) };
    next();
}

export function actorFrom(req: Request): Actor & { type: "USER" } {
    return { type: "USER", userId: req.user!.id, ip: req.ip, requestId: req.requestId };
}
