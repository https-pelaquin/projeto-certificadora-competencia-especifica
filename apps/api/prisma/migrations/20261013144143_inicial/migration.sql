-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('CRIADA', 'AGUARDANDO_COMPLEMENTO', 'EM_VOTACAO', 'PROVISIONADA', 'PAGA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PROVISAO', 'ESTORNO', 'UTILIZACAO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" SERIAL NOT NULL,
    "ano" INTEGER NOT NULL,
    "valorInicial" DECIMAL(14,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteAprovacao" (
    "id" SERIAL NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "periodoMeses" INTEGER NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),

    CONSTRAINT "LimiteAprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" SERIAL NOT NULL,
    "professorId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "limiteId" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "finalidade" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'CRIADA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "solicitacaoId" INTEGER,
    "tipo" "TipoMovimentacao" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "solicitacaoId" INTEGER NOT NULL,
    "registradoPorId" INTEGER NOT NULL,
    "valorPago" DECIMAL(14,2) NOT NULL,
    "justificativa" TEXT,
    "pagoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_ano_key" ON "Orcamento"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE INDEX "Solicitacao_professorId_criadaEm_idx" ON "Solicitacao"("professorId", "criadaEm");

-- CreateIndex
CREATE INDEX "Solicitacao_status_idx" ON "Solicitacao"("status");

-- CreateIndex
CREATE INDEX "Movimentacao_orcamentoId_tipo_idx" ON "Movimentacao"("orcamentoId", "tipo");

-- CreateIndex
CREATE INDEX "Movimentacao_solicitacaoId_idx" ON "Movimentacao"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_solicitacaoId_key" ON "Pagamento"("solicitacaoId");

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_limiteId_fkey" FOREIGN KEY ("limiteId") REFERENCES "LimiteAprovacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- Regras que o Prisma não expressa (RNF05 precisão / RN20 auditoria)
-- ---------------------------------------------------------------

-- Dinheiro nunca é negativo nem zero onde não faz sentido.
-- O sinal do efeito vem do TIPO da movimentação, não do valor.
ALTER TABLE "Orcamento"       ADD CONSTRAINT "Orcamento_valorInicial_check"  CHECK ("valorInicial" >= 0);
ALTER TABLE "LimiteAprovacao" ADD CONSTRAINT "LimiteAprovacao_valor_check"   CHECK ("valor" > 0);
ALTER TABLE "LimiteAprovacao" ADD CONSTRAINT "LimiteAprovacao_periodo_check" CHECK ("periodoMeses" > 0);
ALTER TABLE "Solicitacao"     ADD CONSTRAINT "Solicitacao_valor_check"       CHECK ("valor" > 0);
ALTER TABLE "Movimentacao"    ADD CONSTRAINT "Movimentacao_valor_check"      CHECK ("valor" > 0);
ALTER TABLE "Pagamento"       ADD CONSTRAINT "Pagamento_valorPago_check"     CHECK ("valorPago" > 0);

-- Movimentacao é append-only: o banco recusa UPDATE e DELETE.
CREATE FUNCTION "movimentacao_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Movimentacao é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Movimentacao_append_only"
  BEFORE UPDATE OR DELETE ON "Movimentacao"
  FOR EACH ROW EXECUTE FUNCTION "movimentacao_append_only"();
