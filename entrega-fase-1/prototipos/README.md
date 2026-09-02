# Protótipos da Fase 1

## Ambiente

| Item | Informação |
| --- | --- |
| Ferramenta proposta | Figma |
| Link do projeto | [PREENCHER] |
| Responsável principal | [PREENCHER] |
| Acesso do professor validado | [PREENCHER] |

## Objetivo

Os protótipos devem demonstrar como os diferentes perfis utilizarão a plataforma. Nesta fase, não é necessário representar cada detalhe visual, mas o fluxo e as ações principais precisam estar compreensíveis.

## Rascunhos visuais

Foram geradas três pranchas de baixa fidelidade, com aparência proposital de Windows Paint. Elas devem orientar a disposição dos elementos e a discussão do fluxo, sem limitar a identidade visual que será construída no Figma. Anos, valores, categorias e registros exibidos nas imagens são apenas exemplos visuais e não representam requisitos confirmados.

### Acesso, dashboard e solicitações

![Rascunhos de login, dashboard, lista e formulário de solicitação](01-acesso-dashboard-solicitacoes-paint.png)

### Deliberação e pagamento

![Rascunhos de detalhes, abertura de votação, voto e pagamento](02-deliberacao-pagamento-paint.png)

### Administração, relatório e auditoria

![Rascunhos de orçamento, categorias, relatório anual e auditoria](03-administracao-relatorios-paint.png)

O conjunto de prompts usado para gerar as imagens está registrado em [`prompts-imagegen.md`](prompts-imagegen.md).

## Telas prioritárias

### 1. Login

- Campo de e-mail;
- Campo de senha;
- Recuperação de acesso como possibilidade futura;
- Mensagem de erro de autenticação.

### 2. Dashboard

- Disponível;
- Provisionado;
- Utilizado;
- Quantidade e situação das solicitações;
- Valores por período;
- Professores que mais solicitaram;
- Categorias mais utilizadas.

### 3. Lista de solicitações

- Identificação;
- Solicitante;
- Valor;
- Finalidade;
- Status;
- Data;
- Filtros e busca;
- Ação para acessar os detalhes.

### 4. Nova solicitação

- Valor;
- Finalidade;
- Descrição ou justificativa como campo a validar;
- Demais campos ainda pendentes de confirmação;
- Anexos como possibilidade ainda não confirmada;
- Ações de salvar e enviar.

### 5. Detalhes da solicitação

- Dados do pedido;
- Status atual;
- Linha do tempo;
- Valor solicitado, provisionado e pago;
- Ações permitidas conforme o perfil e o status;
- Histórico visível ao solicitante;
- Área interna do conselho separada.

### 6. Abertura de votação

- Resumo da solicitação;
- Definição do prazo pelo chefe;
- Confirmação da abertura;
- Lista dos membros convocados.

### 7. Votação e comentários

- Resumo da solicitação;
- Aprovar, rejeitar ou abster-se;
- Aviso de que o voto não poderá ser alterado;
- Comentários privados;
- Votos públicos;
- Prazo restante;
- Resultado após o encerramento.

### 8. Administração do orçamento

- Orçamento do ano;
- Atualizações;
- Disponível, provisionado e utilizado;
- Histórico das alterações;
- Limite acumulado configurado.

### 9. Categorias

- Lista de finalidades;
- Inclusão de categoria pelo chefe;
- Estado ativo ou inativo como decisão a validar.

### 10. Registro de pagamento

- Valor provisionado;
- Valor efetivamente pago;
- Justificativa obrigatória quando houver diferença;
- Confirmação da operação;
- Resultado da movimentação.

### 11. Relatório anual

- Seleção do ano;
- Prévia dos totais e solicitações;
- Ação para gerar PDF.

### 12. Usuários e perfis

- Usuários cadastrados;
- Perfis simultâneos;
- Período de atuação como chefe ou conselheiro;
- Permissões do responsável administrativo ainda a validar.

### 13. Auditoria

- Ator;
- Ação;
- Entidade;
- Data e hora;
- Valores anteriores e posteriores;
- Filtros.

## Fluxos mínimos a demonstrar

1. Professor cria uma solicitação aprovada automaticamente;
2. Professor ultrapassa o limite e a solicitação vai para votação;
3. Chefe abre a votação;
4. Conselheiro comenta e registra um voto;
5. Sistema apresenta o resultado;
6. Solicitação aprovada é provisionada;
7. Chefe registra o pagamento;
8. Dashboard e relatório refletem a movimentação;
9. Solicitação cancelada devolve o valor ao disponível.

## Estados que os protótipos devem considerar

- Carregamento;
- Lista vazia;
- Erro;
- Acesso negado;
- Confirmação de ação;
- Prazo de votação encerrado;
- Voto já registrado;
- Saldo insuficiente, embora a regra ainda precise ser validada;
- Solicitação paga sem possibilidade de edição ou cancelamento.

## Organização dos arquivos

Adicionar nesta pasta:

- Imagens exportadas em PNG;
- PDF do protótipo, se produzido;
- Diagrama do fluxo das telas;
- Arquivo de referência visual, quando aplicável.

Sugestão de nomes:

```text
01-login.png
02-dashboard.png
03-lista-solicitacoes.png
04-nova-solicitacao.png
05-detalhes-solicitacao.png
06-votacao.png
07-pagamento.png
08-relatorio-anual.png
```

Não adicionar arquivos internos ou temporários do Figma. Registrar o link compartilhado e conferir o acesso do professor.
