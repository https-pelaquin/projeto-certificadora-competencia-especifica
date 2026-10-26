// Quem executa uma ação: gravado na auditoria e repassado entre módulos.
export type Actor =
    | { type: "USER"; userId: number; ip?: string; requestId?: string }
    | { type: "SYSTEM"; job: string };

export function actorUserId(actor: Actor): number | null {
    return actor.type === "USER" ? actor.userId : null;
}
