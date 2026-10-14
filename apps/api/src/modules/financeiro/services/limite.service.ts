import { Prisma } from "../../../../generated/prisma/client";
import * as limiteRepository from "../repositories/limite.repository";
import * as solicitacaoRepository from "../repositories/solicitacao.repository";
import { prisma } from "../../../shared/prisma";
import { RegraDeNegocioError } from "../../../shared/errors";
import { STATUS_QUE_CONTAM_NO_LIMITE } from "../financeiro.config";

type Db = Prisma.TransactionClient;


export async function cadastrarLimite(dados:{
    valor: Prisma.Decimal,
    periodoMeses: number,
    vigenteDesde: Date,
}){

    if(dados.valor.lessThanOrEqualTo(0)){
        throw new RegraDeNegocioError("Valor do limite deve ser maior que zero");
    }

    if(dados.periodoMeses <= 0){
        throw new RegraDeNegocioError("Período do limite deve ser pelo menos 1 mes");
    }

        return await prisma.$transaction(async (tx) => {
        const limiteVigente = await limiteRepository.buscarVigente(tx, dados.vigenteDesde);

        if (limiteVigente && dados.vigenteDesde <= limiteVigente.vigenteDesde) {
            throw new RegraDeNegocioError(
                "O novo limite deve começar depois do início do limite vigente",
            );
}

        if(limiteVigente){
            await limiteRepository.encerrarLimite(tx, limiteVigente.id, dados.vigenteDesde);
        }

        return await limiteRepository.criar(tx, dados);
    });
}



    export async function verificarLimite(db: Db, dados:{
        professorId: number;
        valorNovo: Prisma.Decimal;
        agora:Date,
        excluirSolicitacaoId?: number;
    }){

        const limite = await limiteRepository.buscarVigente(db, dados.agora);

        if(!limite){
            throw new RegraDeNegocioError("Não existe limite vigente");
        }

        const desde = subtrairMeses(dados.agora, limite.periodoMeses);

        const acumulado = await solicitacaoRepository.somarPorProfessor(db, {
            professorId: dados.professorId,
            status: STATUS_QUE_CONTAM_NO_LIMITE,
            desde,
            excluirSolicitacaoId: dados.excluirSolicitacaoId,
        });


        const total = acumulado.plus(dados.valorNovo);
        const dentroDoLimite = total.lessThanOrEqualTo(limite.valor);

        return {
            dentroDoLimite,
            limiteId: limite.id,
            limite: limite.valor,
            acumulado,
            total,
            restante: dentroDoLimite ? limite.valor.minus(total) : new Prisma.Decimal(0),
        };

    }


function subtrairMeses(data: Date, meses: number): Date {
    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() - meses;

    // dia 0 do mês seguinte = último dia do mês-alvo
    const ultimoDiaDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const dia = Math.min(data.getUTCDate(), ultimoDiaDoMes);

    return new Date(Date.UTC(
        ano, mes, dia,
        data.getUTCHours(), data.getUTCMinutes(), data.getUTCSeconds(), data.getUTCMilliseconds(),
    ));
}