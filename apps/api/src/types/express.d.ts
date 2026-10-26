import type { Role } from "../../generated/prisma/client";
import type { Permission } from "../modules/auth/permissions";

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    roles: Role[];
    permissions: Set<Permission>;
};

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            user?: AuthUser;
        }
    }
}

declare module "express-session" {
    interface SessionData {
        userId: number;
    }
}
