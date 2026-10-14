import { Prisma, StatusSolicitacao } from "../../../../generated/prisma/client";

type Db = Prisma.TransactionClient;


export async function somarPorProfessor(db: Db, dados: {
  professorId: number;
  status: StatusSolicitacao[];
  desde: Date;
  excluirSolicitacaoId?: number;
}) {
  const resultado = await db.solicitacao.aggregate({
    _sum: { valor: true },
    where: {
      professorId: dados.professorId,
      status: { in: dados.status },
      criadaEm: { gte: dados.desde },
      ...(dados.excluirSolicitacaoId !== undefined && {
        id: { not: dados.excluirSolicitacaoId },
      }),
    },
  });

  return resultado._sum.valor ?? new Prisma.Decimal(0);
}