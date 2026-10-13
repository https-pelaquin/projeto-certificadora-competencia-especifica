import { Prisma} from "../../../../generated/prisma/client";


type Db = Prisma.TransactionClient;

export async function criar(db: Db, dados: {
  ano: number;
  valorInicial: Prisma.Decimal;
}) {
  return await db.orcamento.create({
    data: {
      ...dados,
    },
  });
}

export async function buscarPorId(db: Db, id: number) {
  return await db.orcamento.findUnique({
    where: {
      id: id,
    },
  });
}

export async function buscarPorAno(db: Db, ano: number) {
  return await db.orcamento.findUnique({
    where: {
      ano: ano,
    },
  });
}

export async function travar(db: Db, id: number) {
  const linhas = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Orcamento" WHERE id = ${id} FOR UPDATE
  `;
  return linhas.length > 0;
}