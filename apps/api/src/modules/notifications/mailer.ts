import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";

export type MailTransport = Pick<Transporter, "sendMail">;

export const mailer: MailTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});
