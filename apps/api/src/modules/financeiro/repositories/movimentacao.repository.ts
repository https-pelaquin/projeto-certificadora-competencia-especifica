import { Prisma, TipoMovimentacao } from "../../../../generated/prisma/client";

type Db = Prisma.TransactionClient;

export async function criar(db: Db, dados: {
  orcamentoId: number;
  valor: Prisma.Decimal;
  tipo: TipoMovimentacao;
}) {
  return await db.movimentacao.create({
    data: {
      ...dados,
    },
  });
}

export async function somarPorTipo(db: Db, orcamentoId: number) {

    return await db.movimentacao.groupBy({
        by: ['tipo'],
        where: {
            orcamentoId: orcamentoId,
        },
        _sum: {
            valor: true,
        },
    });
}