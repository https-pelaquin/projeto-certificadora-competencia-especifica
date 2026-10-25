import { beforeEach, expect, it } from "vitest";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { enqueue, nextAttemptAt, sendPendingEmails } from "../notifications.service";

beforeEach(resetDatabase);

const invite = (dedupeKey = "invite:1") => ({
    template: "INVITE" as const,
    to: "ana@x.com",
    dedupeKey,
    data: { name: "Ana <script>", link: "http://localhost/definir-senha?token=abc" },
});

const okTransport = () => {
    const sent: Record<string, string>[] = [];
    return { sent, sendMail: async (m: Record<string, string>) => { sent.push(m); return {}; } };
};
const failingTransport = { sendMail: async () => { throw new Error("SMTP fora do ar"); } };

it("deduplica pela dedupeKey", async () => {
    await enqueue(prisma, invite());
    await enqueue(prisma, invite(), invite("invite:2"));
    expect(await prisma.emailOutbox.count()).toBe(2);
});

it("envia pendentes, marca como SENT e escapa HTML", async () => {
    await enqueue(prisma, invite());
    const transport = okTransport();

    expect(await sendPendingEmails(new Date(), transport as never)).toEqual({ sent: 1, failed: 0 });
    expect(transport.sent[0]!.to).toBe("ana@x.com");
    expect(transport.sent[0]!.html).toContain("Ana &lt;script&gt;");
    expect((await prisma.emailOutbox.findFirstOrThrow()).status).toBe("SENT");

    expect(await sendPendingEmails(new Date(), transport as never)).toEqual({ sent: 0, failed: 0 });
});

it("falha agenda nova tentativa e, esgotadas, marca FAILED", async () => {
    await enqueue(prisma, invite());
    let now = new Date();

    for (let attempt = 1; attempt <= 6; attempt++) {
        expect(await sendPendingEmails(now, failingTransport)).toEqual({ sent: 0, failed: 1 });
        const email = await prisma.emailOutbox.findFirstOrThrow();
        expect(email.attempts).toBe(attempt);
        expect(email.status).toBe(attempt < 6 ? "PENDING" : "FAILED");
        expect(email.lastError).toBe("SMTP fora do ar");
        // Antes do horário agendado, nada é reenviado.
        expect(await sendPendingEmails(now, failingTransport)).toEqual({ sent: 0, failed: 0 });
        now = new Date(email.nextAttemptAt.getTime() + 1);
    }
});

it("espera entre tentativas: 1 min, 5 min, 30 min, 2 h, 12 h", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const minutes = [1, 2, 3, 4, 5].map((a) => (nextAttemptAt(a, now)!.getTime() - now.getTime()) / 60_000);
    expect(minutes).toEqual([1, 5, 30, 120, 720]);
    expect(nextAttemptAt(6, now)).toBeNull();
});
