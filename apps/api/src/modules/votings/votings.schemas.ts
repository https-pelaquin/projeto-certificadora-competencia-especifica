import { z } from "zod";
import { isoDateTime } from "../../shared/schemas";

export const openBody = z.object({ deadline: isoDateTime });

export const voteBody = z.object({ choice: z.enum(["APPROVE", "REJECT", "ABSTAIN"]) });

export const tieBreakBody = z.object({ choice: z.enum(["APPROVE", "REJECT"]) });

export const listQuery = z.object({
    status: z.enum(["OPEN", "AWAITING_TIE_BREAK", "CLOSED", "CANCELED"]).optional(),
});

export const commentBody = z.object({
    body: z.string().trim().min(1, "Escreva o comentário").max(2000, "Máximo de 2.000 caracteres"),
});
