import { env } from "../config/env";

type Level = "info" | "warn" | "error";

// Log técnico em JSON no stdout. Não é auditoria funcional (ver modules/audit).
export function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
    if (env.NODE_ENV === "test" && level !== "error") {
        return;
    }
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
    (level === "error" ? console.error : console.log)(line);
}
