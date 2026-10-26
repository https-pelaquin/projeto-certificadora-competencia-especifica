import { log } from "../shared/logger";
import { sendPendingEmails } from "../modules/notifications/notifications.service";
import { closeExpiredVotings } from "../modules/votings/votings.service";

// Rotinas leem o estado do banco a cada ciclo: sobrevivem a reinício e não dependem de setTimeout por item.
function every(name: string, ms: number, task: () => Promise<unknown>) {
    let running = false;
    const timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            await task();
        } catch (error) {
            log("error", `falha na rotina ${name}`, { error: error instanceof Error ? error.message : String(error) });
        } finally {
            running = false;
        }
    }, ms);
    return () => clearInterval(timer);
}

export function startJobs() {
    const stops = [
        every("closeExpiredVotings", 60_000, () => closeExpiredVotings()),
        every("sendPendingEmails", 30_000, () => sendPendingEmails()),
    ];
    return () => stops.forEach((stop) => stop());
}
