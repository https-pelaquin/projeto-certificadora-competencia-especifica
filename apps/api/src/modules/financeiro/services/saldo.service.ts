import { Prisma, TipoMovimentacao } from "../../../../generated/prisma/client";
import * as orcamentoRepository from "../repositories/orcamento.repository";
import * as movimentacaoRepository from "../repositories/movimentacao.repository";
import { NotFoundError } from "../../../shared/errors";

const ZERO = new Prisma.Decimal(0);

type Db = Prisma.TransactionClient;

export async function calcularSaldo(db: Db, orcamentoId: number) {
        const orcamento = await orcamentoRepository.buscarPorId(db, orcamentoId);
    if (!orcamento) {
        throw new NotFoundError("Orcamento nao encontrado");
    }
        const movimentacoes = await movimentacaoRepository.somarPorTipo(db, orcamentoId);

    const somaDe = (tipo: TipoMovimentacao) => movimentacoes.find(m => m.tipo === tipo)?._sum?.valor ?? ZERO;

    const ajustePositivo = somaDe("AJUSTE_POSITIVO");
    const ajusteNegativo = somaDe("AJUSTE_NEGATIVO");
    const provisao = somaDe("PROVISAO");
    const estorno = somaDe("ESTORNO");
    const utilizacao = somaDe("UTILIZACAO");

    const total = orcamento.valorInicial.plus(ajustePositivo).minus(ajusteNegativo);
    const provisionado = provisao.minus(estorno).minus(utilizacao);
    const utilizado = utilizacao;
    const disponivel = total.minus(provisao).plus(estorno);

    return { total, provisionado, utilizado, disponivel };
}

