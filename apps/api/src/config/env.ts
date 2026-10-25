import "dotenv/config";
import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa de pelo menos 32 caracteres"),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(1),
    APP_URL: z.url(),
    CORS_ORIGIN: z.url(),
    // Só os testes reduzem o custo, para não ficarem lentos.
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error("Variáveis de ambiente inválidas:", z.prettifyError(parsed.error));
    process.exit(1);
}

export const env = parsed.data;
