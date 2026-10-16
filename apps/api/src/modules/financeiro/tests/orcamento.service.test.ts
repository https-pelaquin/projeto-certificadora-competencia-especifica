import { randomInt } from 'node:crypto';
import { ajustarOrcamento, criarOrcamento } from '../services/orcamento.service';
import { it , expect } from 'vitest';
import { Prisma } from '../../../../generated/prisma/client';
import { ConflictError, RegraDeNegocioError } from '../../../shared/errors';

const D = (v: string) => new Prisma.Decimal(v);

const anoUnico = () => randomInt(2040, 9_000_000);


it("ajuste negativo igual ao disponivel é aceito", async () => {
    const orcamento = await criarOrcamento({ ano: anoUnico(), valorInicial: D("1000.00") });
    const ajuste = await ajustarOrcamento(orcamento.id, { valor: D("1000.00"), tipo: "AJUSTE_NEGATIVO" });

    expect(ajuste.disponivel).toEqual(D("0.00"));
});

it("ajuste negativo maior que o disponivel é rejeitado", async () => {
    const orcamento = await criarOrcamento({ ano: anoUnico(), valorInicial: D("1000.00") });
    await expect(ajustarOrcamento(orcamento.id, { valor: D("1000.01"), tipo: "AJUSTE_NEGATIVO" })).rejects.toThrow(RegraDeNegocioError);

});

it("ajuste negativo retorna o saldo correto", async () => {
    const orcamento = await criarOrcamento({ ano: anoUnico(), valorInicial: D("1000.00") });
    const ajuste = await ajustarOrcamento(orcamento.id, { valor: D("500.00"), tipo: "AJUSTE_NEGATIVO" });
    expect(ajuste.disponivel).toEqual(D("500.00"));
});
    

it("criar um novo orçamento no mesmo ano lança um erro", async () => {
    const ano = anoUnico();
    await criarOrcamento({ ano, valorInicial: D("1000.00") });
    await expect(criarOrcamento({ ano: ano, valorInicial: D("500.00") })).rejects.toThrow(ConflictError);

});