import { Prisma } from "../../../../generated/prisma/client";

type Db = Prisma.TransactionClient;

export async function criar(db: Db, dados: {
  valor: Prisma.Decimal,
  periodoMeses: number,
  vigenteDesde: Date,
  vigenteAte?: Date | null,
}) {
  return await db.limiteAprovacao.create({
    data: {
      ...dados
    }
  });
}

export async function buscarVigente(db: Db, data: Date) {
    return await db.limiteAprovacao.findFirst({
        where: {
            vigenteDesde: {
                lte: data,
            },
            OR: [
                {
                    vigenteAte: null,
                },
                {
                    vigenteAte: {
                        gt: data,
                    },
                },
            ],
        },
        orderBy: {
            vigenteDesde: 'desc',
        },
    });
}

export async function encerrarLimite(db: Db, id: number, dataEncerramento: Date) {
    return await db.limiteAprovacao.update({
        where: {
            id: id,
        },
        data: {
            vigenteAte: dataEncerramento,
        },
    });
}