import { it , expect } from 'vitest';
import { Prisma } from '../../../../generated/prisma/client';
import { cadastrarLimite } from '../services/limite.service';
import { RegraDeNegocioError } from '../../../shared/errors';

const D = (v: string) => new Prisma.Decimal(v);

it("cadastro de limite", async () => {
    const limite = await cadastrarLimite({ valor: D("1000.00"), periodoMeses: 12, vigenteDesde: new Date() });
    expect(limite.valor).toEqual(D("1000.00"));
    expect(limite.periodoMeses).toEqual(12);
});

it("se valor do limite for menor ou igual a 0 lança um erro", async () => {
    await expect(cadastrarLimite({ valor: D("0.00"), periodoMeses: 12, vigenteDesde: new Date() })).rejects.toThrow(RegraDeNegocioError);
});

it("se periodo dos meses limite for menor 1 mes lança um erro", async () => {
    await expect(cadastrarLimite({ valor: D("200.00"), periodoMeses: 0, vigenteDesde: new Date() })).rejects.toThrow(RegraDeNegocioError);
});


it("se cadastrar antes do periodo que acabou deve lançar um erro", async () => {
    const agora = new Date();
    await cadastrarLimite({ valor: D("1000.00"), periodoMeses: 12, vigenteDesde: agora });
    await expect(cadastrarLimite({ valor: D("2000.00"), periodoMeses: 7, vigenteDesde: agora })).rejects.toThrow("O novo limite deve começar depois do início do limite vigente");

});
