# Roteiro do vídeo — Fase 2, parte 2

## Informações gerais

| Item | Definição |
| --- | --- |
| Duração planejada | 13 a 15 minutos |
| Apresentadores | 5 — todos aparecem com o rosto visível |
| Formato sugerido | Chamada gravada (Meet/Teams/OBS) com câmera e compartilhamento de tela |
| Local de hospedagem | [PREENCHER] (sugestão: YouTube "não listado" ou Google Drive com link público) |
| Link final | [PREENCHER] |
| Data de entrega | [PREENCHER] |

## Objetivo

Mostrar o **estado atual** do desenvolvimento, com **evidências** de que cada atividade foi planejada, executada e concluída. Cada integrante apresenta a parte em que mais atuou e, no fim, o grupo expõe os problemas enfrentados e as soluções encaminhadas.

## Regra de cada bloco: planejado → executado → evidência

O professor avisou que "não basta dizer eu fiz". Cada integrante segue a mesma estrutura, sempre com a tela compartilhada:

1. **Planejado:** o cartão do Trello ou o documento em que a tarefa foi definida (responsável, critério de aceitação, prazo);
2. **Executado:** o que foi feito, mostrando o artefato real (código, commit, tela no Figma, documento);
3. **Evidência:** algo verificável — teste rodando, histórico de commits, histórico de versões do Figma, PR revisado;
4. **Próximo passo:** uma frase.

Evitar ler o documento; mostrar os artefatos e explicar o porquê das decisões.

## Divisão do tempo

| Ordem | Bloco | Apresentador | Tempo |
| --- | --- | --- | --- |
| 1 | Abertura e contexto | [PREENCHER] (sugestão: Pessoa 2) | 1 min |
| 2 | Telas e design system | Pessoa 3 — [PREENCHER] | 2 min |
| 3 | Telas operacionais | Pessoa 4 — [PREENCHER] | 2 min |
| 4 | Telas analíticas e qualidade | Pessoa 5 — [PREENCHER] | 2 min |
| 5 | Backend financeiro | Pessoa 1 — [PREENCHER] | 2 min 30 s |
| 6 | Arquitetura e backend de processos | Pessoa 2 — Bruno Pelaquin | 2 min 30 s |
| 7 | Problemas, soluções e próximos passos | [PREENCHER] (sugestão: Pessoa 1 e Pessoa 5) | 1 min 30 s |
| | **Total** | | **≈ 13 min 30 s** |

A ordem vai do que o usuário vê (telas) para o que sustenta o sistema (backend e arquitetura), terminando nos problemas. O professor pede que essa seja a última parte.

---

## 1. Abertura e contexto — 1 min

**Na tela:** slide de título com os 5 integrantes e o cliente.

- Apresentar o grupo e o cliente (Prof. Lucas Sampaio, DACOM).
- Problema em uma frase: o extrato da UGR não mostra o que foi aprovado e ainda não foi pago, então o departamento não sabe o saldo realmente livre.
- O que mudou desde a Fase 1:
  - proposta enviada ao cliente para validação formal;
  - telas no Figma;
  - arquitetura consolidada;
  - backend financeiro em desenvolvimento.
- Como o vídeo está organizado: cada um mostra sua parte com evidências; no fim, os problemas e as soluções.

## 2. Pessoa 3 — Telas e design system — 2 min

**Na tela:** Figma (design system e telas), cartões do Trello da Pessoa 3.

- **Planejado:** cartões do design system, layout, login e solicitação.
- **Executado:**
  - evolução do rascunho da Fase 1 para o Figma (mostrar lado a lado);
  - componentes compartilhados: cores, tipografia, botões, formulários, tabelas;
  - layout e menu, que mudam conforme o perfil do usuário;
  - telas de login, nova/editar solicitação e acompanhamento.
- **Evidência:** histórico de versões do Figma; cartões no Trello com responsável e status.
- **Destacar:** estados de carregamento, erro e lista vazia; solicitação paga sem botões de editar e cancelar.
- **Próximo passo:** implementar o layout base em React + Tailwind + shadcn/ui.

## 3. Pessoa 4 — Telas operacionais — 2 min

**Na tela:** Figma (telas do chefe e do conselho), cartões do Trello da Pessoa 4.

- **Planejado:** cartões de lista, detalhes, votação, pagamento, orçamento e categorias.
- **Executado:**
  - lista e detalhes da solicitação, com a linha do tempo;
  - abertura de votação (prazo definido pelo chefe);
  - tela de votação com o aviso de voto definitivo e os comentários internos do conselho;
  - registro de pagamento com justificativa obrigatória quando o valor muda;
  - orçamento e categorias.
- **Evidência:** telas no Figma e cartões do Trello.
- **Destacar:** como cada tela reflete uma regra de negócio (voto imutável, comentários invisíveis ao solicitante, justificativa da diferença).
- **Próximo passo:** integrar com a API assim que as rotas de solicitação e votação existirem.

## 4. Pessoa 5 — Telas analíticas e qualidade — 2 min

**Na tela:** Figma (dashboard, relatório, auditoria), plano de testes.

- **Planejado:** cartões do dashboard, relatório anual, auditoria e testes.
- **Executado:**
  - dashboard com disponível, provisionado e utilizado, solicitações por status, professores e categorias;
  - tela do relatório anual (seleção do ano e geração do PDF);
  - tela de auditoria com filtros (ator, ação, entidade, data, valores antes e depois).
- **Qualidade:**
  - critérios de responsividade e acessibilidade (contraste, teclado, rótulos);
  - fluxos mínimos que viram testes Playwright: pedido aprovado automaticamente; pedido que vai à votação; voto; pagamento; cancelamento devolvendo saldo.
- **Evidência:** telas no Figma, lista de fluxos de teste, cartões do Trello.
- **Próximo passo:** implementar o dashboard sobre a API de indicadores e configurar o Playwright.

## 5. Pessoa 1 — Backend financeiro — 2 min 30 s

**Na tela:** VS Code com `apps/api`, terminal, histórico de commits no GitHub.

- **Planejado:** etapa "Fundação técnica" e "Fluxo de solicitações" do cronograma; regras de orçamento, saldo e limite.
- **Executado** (mostrar o código):
  - `docker-compose.yml`: PostgreSQL 17 com healthcheck;
  - `schema.prisma` e a migration: valores em `numeric`, nunca `float`; `CHECK` de valores positivos; trigger que impede alterar ou apagar movimentações;
  - `saldo.service.ts`: disponível, provisionado e utilizado calculados a partir das movimentações (ledger), não guardados como totais;
  - `orcamento.service.ts`: ajuste com `SELECT … FOR UPDATE`, explicando por que duas operações ao mesmo tempo não podem estourar o saldo;
  - `limite.service.ts`: o novo limite encerra o anterior; acumulado do professor no período.
- **Evidência:**
  - rodar os testes **ao vivo** (`npm test` em `apps/api`, com o banco no Docker) e mostrar os 8 testes;
  - commits de 13 a 15/10 no GitHub.
- **Próximo passo:** solicitação, provisionamento, cancelamento e pagamento, já no modelo de dados consolidado.

> Ensaiar antes: subir o banco (`docker compose up -d`), aplicar as migrations e confirmar que os testes passam. Não afirmar no vídeo que os testes passam sem ter rodado.

## 6. Pessoa 2 — Arquitetura e backend de processos — 2 min 30 s

**Na tela:** `docs/architecture/arquitetura.md` no GitHub (diagrama ER renderizado), `backend-processos.md`.

- **Planejado:**
  - escopo da Pessoa 2: autenticação, perfis, votação, auditoria, notificações, PDF, OpenAPI, Docker e CI;
  - integrar as frentes num modelo de dados único.
- **Executado:**
  - **diagrama da arquitetura:** monólito modular, por que não microserviços, PostgreSQL também para sessão e fila de e-mail;
  - **diagrama ER:**
    - perfis com vigência (mandato de chefe);
    - voto único garantido pelo banco;
    - desempate separado do voto;
    - auditoria só de inclusão;
  - **decisões com alternativas avaliadas:**
    - sessão no servidor × JWT;
    - prazo da votação gravado no banco com rotina idempotente × timer em memória;
    - fila de e-mails no banco (outbox) para não perder nem duplicar e-mails;
  - **segurança:** cookie `httpOnly`, limite de tentativas de login, validação de toda entrada, autorização em toda rota;
  - **contratos com a Pessoa 1:** o resultado da votação chama o provisionamento na mesma transação.
- **Evidência:**
  - documentos versionados no GitHub com data;
  - `AGENTS.md` com as regras da equipe;
  - e-mail de validação enviado ao cliente;
  - [se implementado antes da gravação: PR da API base / autenticação com testes].
- **Próximo passo:** API base, login com sessão, perfis e CI no GitHub Actions.

## 7. Problemas, soluções e próximos passos — 1 min 30 s

**Na tela:** seção 10 do documento (tabela de problemas e soluções).

Escolher 4 problemas, misturando regra de negócio, tecnologia e organização:

| Problema | Solução |
| --- | --- |
| Regras do cliente ainda abertas (período do limite, votação sem votos, saldo insuficiente) | E-mail formal com as pendências; até a resposta, padrão provisório isolado e configurável |
| Duas aprovações simultâneas poderiam estourar o saldo | Bloqueio de linha no PostgreSQL — já implementado |
| Código inicial e arquitetura divergiram enquanto evoluíam em paralelo | Arquitetura consolidada com plano de alinhamento; pull requests com revisão cruzada |
| Dois integrantes de backend para três frentes de interface | Backend dividido por risco; contratos de API documentados para o frontend avançar em paralelo |

**Encerramento sugerido:**

> A base financeira já está implementada e testada, a arquitetura está consolidada e as telas estão definidas. A próxima etapa integra backend e frontend em fatias verticais, sempre com cartão no Trello, pull request revisado e testes.

---

## Evidências a preparar antes de gravar

| Evidência | Responsável | Pronta |
| --- | --- | --- |
| Slide de título com nomes | [PREENCHER] | [ ] |
| Link do Figma aberto e organizado por tela | Pessoa 3 | [ ] |
| Quadro do Trello atualizado (responsáveis, listas, cartões concluídos) | Todos | [ ] |
| Comparação rascunho Fase 1 × Figma | Pessoa 3 | [ ] |
| Lista de fluxos de teste Playwright | Pessoa 5 | [ ] |
| Banco no Docker e testes rodando localmente | Pessoa 1 | [ ] |
| `docs/architecture/` versionado no GitHub (diagrama renderizado) | Pessoa 2 | [ ] |
| Tabela de problemas e soluções revisada | Todos | [ ] |

## Checklist de gravação

- [ ] Todos os cinco aparecem com o rosto visível;
- [ ] Cada um mostra planejado → executado → evidência;
- [ ] Nomes e responsabilidades corretos;
- [ ] Áudio claro e texto legível na tela (zoom no editor e no navegador);
- [ ] Sem senhas, tokens, `.env` ou dados pessoais na tela;
- [ ] Problemas e soluções apresentados no fim;
- [ ] Duração entre 10 e 15 minutos;
- [ ] Vídeo revisado pelo grupo;
- [ ] Link testado numa janela anônima;
- [ ] Link adicionado ao documento da Fase 2.
