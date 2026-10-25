import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import pg from "pg";
import { env } from "../config/env";

const PgStore = connectPgSimple(session);
const EIGHT_HOURS_MS = 8 * 60 * 60_000;

export const sessionPool = new pg.Pool({ connectionString: env.DATABASE_URL });

export function createSessionMiddleware() {
    return session({
        name: "dacom.sid",
        secret: env.SESSION_SECRET,
        store: new PgStore({
            pool: sessionPool,
            tableName: "session",
            pruneSessionInterval: env.NODE_ENV === "test" ? false : 15 * 60,
        }),
        resave: false,
        saveUninitialized: false,
        rolling: true, // expiração por inatividade: cada requisição renova o prazo
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: env.NODE_ENV === "production",
            maxAge: EIGHT_HOURS_MS,
        },
    });
}
