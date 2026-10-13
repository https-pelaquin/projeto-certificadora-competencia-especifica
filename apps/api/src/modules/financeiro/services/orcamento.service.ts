import { prisma } from "../../../shared/prisma";
import { Prisma, TipoMovimentacao } from "../../../../generated/prisma/client";
import * as orcamentoRepository from "../repositories/orcamento.repository";
import * as movimentacaoRepository from "../repositories/movimentacao.repository";
import { ConflictError, NotFoundError, RegraDeNegocioError } from "../../../shared/errors";
import * as saldoService from "./saldo.service";

export async function criarOrcamento(dados: {
    ano: number;
    valorInicial: Prisma.Decimal;
}) {
    try {
        return await orcamentoRepository.criar(prisma, dados);
    } catch (erro) {
        if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new ConflictError(`Orcamento ja existe neste ano ${dados.ano}`);
        }
        throw erro;
    }
}

export async function atualizarOrcamento(orcamentoId: number, dados: {
    valor: Prisma.Decimal;
    tipo: Extract<TipoMovimentacao, "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO">;
}) {

    if(dados.valor.lessThanOrEqualTo(0)){
        throw new RegraDeNegocioError("O valor do ajuste deve ser maior que zero");
    }
    
    return await prisma.$transaction(async (tx) => {
        const existe = await orcamentoRepository.travar(tx, orcamentoId);
        if (!existe) {
            throw new NotFoundError("Orcamento nao encontrado");
        }


        if(dados.tipo === "AJUSTE_NEGATIVO"){
            const saldo = await saldoService.calcularSaldo(tx, orcamentoId);
            if(saldo.disponivel.lessThan(dados.valor)){
                throw new RegraDeNegocioError("O saldo do orçamento não pode ficar negativo");
            }
        }

        await movimentacaoRepository.criar(tx, {
            orcamentoId: orcamentoId,
            ...dados
        });

        return saldoService.calcularSaldo(tx, orcamentoId);
    });

}



export async function buscarOrcamentoPorId(orcamentoId: number) {
    return await orcamentoRepository.buscarPorId(prisma, orcamentoId);
}