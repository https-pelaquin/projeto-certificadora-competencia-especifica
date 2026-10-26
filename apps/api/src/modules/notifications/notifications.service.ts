import { env } from "../../config/env";
import { prisma, type Db } from "../../shared/prisma";
import { log } from "../../shared/logger";
import { mailer, type MailTransport } from "./mailer";
import { render, type EmailMessage } from "./notifications.templates";
import * as notificationsRepository from "./notifications.repository";

export type OutgoingEmail = EmailMessage & { to: string; dedupeKey: string };

const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 720];

// Gravar na mesma transação da ação: o e-mail só sai se a ação for confirmada.
export function enqueue(db: Db, ...emails: OutgoingEmail[]) {
    return notificationsRepository.enqueue(db, emails.map((e) => ({
        dedupeKey: e.dedupeKey,
        toEmail: e.to,
        template: e.template,
        data: e.data,
    })));
}

export function nextAttemptAt(attempts: number, now: Date): Date | null {
    const minutes = RETRY_DELAYS_MINUTES[attempts - 1];
    return minutes === undefined ? null : new Date(now.getTime() + minutes * 60_000);
}

// Garantia "pelo menos uma vez": se o processo cair entre o envio e o commit, o e-mail sai de novo.
export async function sendPendingEmails(now = new Date(), transport: MailTransport = mailer, batchSize = 20) {
    return prisma.$transaction(async (tx) => {
        const emails = await notificationsRepository.lockDue(tx, now, batchSize);
        let sent = 0;
        let failed = 0;

        for (const email of emails) {
            const attempts = email.attempts + 1;
            try {
                const content = render({ template: email.template, data: email.data } as EmailMessage);
                await transport.sendMail({ from: env.MAIL_FROM, to: email.toEmail, ...content });
                await notificationsRepository.update(tx, email.id, { status: "SENT", attempts, sentAt: now, lastError: null });
                sent++;
            } catch (error) {
                const retryAt = nextAttemptAt(attempts, now);
                const lastError = error instanceof Error ? error.message : String(error);
                await notificationsRepository.update(tx, email.id, {
                    attempts,
                    lastError,
                    ...(retryAt ? { nextAttemptAt: retryAt } : { status: "FAILED" }),
                });
                log("warn", "falha ao enviar e-mail", { emailId: email.id, attempts, lastError });
                failed++;
            }
        }

        return { sent, failed };
    }, { timeout: 120_000 });
}
