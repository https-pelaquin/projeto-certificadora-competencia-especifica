import type { Request, Response } from "express";
import * as authSchemas from "./auth.schemas";
import * as authService from "./auth.service";

function context(req: Request) {
    return { ip: req.ip, requestId: req.requestId };
}

export async function login(req: Request, res: Response) {
    const body = authSchemas.loginBody.parse(req.body);
    const userId = await authService.login(body.email, body.password, context(req));

    // Novo id de sessão no login evita fixação de sessão.
    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userId = userId;
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

    res.status(204).end();
}

export async function logout(req: Request, res: Response) {
    await new Promise<void>((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));
    res.clearCookie("dacom.sid");
    res.status(204).end();
}

export function me(req: Request, res: Response) {
    const user = req.user!;
    res.json({ id: user.id, name: user.name, email: user.email, roles: user.roles, permissions: [...user.permissions] });
}

export async function forgotPassword(req: Request, res: Response) {
    const body = authSchemas.forgotPasswordBody.parse(req.body);
    await authService.requestPasswordReset(body.email);
    res.status(204).end();
}

export async function resetPassword(req: Request, res: Response) {
    const body = authSchemas.resetPasswordBody.parse(req.body);
    await authService.setPasswordWithToken(body.token, body.password, context(req));
    res.status(204).end();
}
