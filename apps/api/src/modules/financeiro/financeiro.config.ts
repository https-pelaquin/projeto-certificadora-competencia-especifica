import { StatusSolicitacao } from "../../../generated/prisma/client";

//confirmar quais status entram no acumulado do professor.
export const STATUS_QUE_CONTAM_NO_LIMITE: StatusSolicitacao[] = ["PROVISIONADA", "PAGA", "EM_VOTACAO"];