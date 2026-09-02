# Plataforma de Gestão de Recursos Financeiros do DACOM

Sistema web proposto para centralizar e automatizar a solicitação, aprovação, provisionamento, utilização e prestação de contas dos recursos financeiros do DACOM.

> **Status:** Fase 1 — levantamento de requisitos e desenho da solução. O repositório ainda não contém uma aplicação executável.

## Contexto do problema

Atualmente, o departamento possui apenas o extrato da UGR no sistema institucional. Esse extrato registra as movimentações efetivadas, mas não representa valores já comprometidos por solicitações aprovadas. A ausência desse controle dificulta saber quanto do orçamento está realmente disponível.

A solução deverá representar os recursos em três estados:

- **disponível:** saldo ainda livre para novas solicitações;
- **provisionado:** valor aprovado e reservado, mas ainda não pago;
- **utilizado:** valor cujo pagamento ou prestação de contas foi registrado.

O sistema não substituirá inicialmente o trâmite burocrático realizado no Sistema Eletrônico de Informações (SEI). Uma integração futura por RPA está prevista.

## Objetivos

- Centralizar solicitações de recursos e seu acompanhamento;
- Automatizar aprovações abaixo do limite aplicável;
- Conduzir votações do Conselho Departamental quando necessárias;
- Controlar os valores disponíveis, provisionados e utilizados;
- Registrar pagamentos, cancelamentos e ajustes justificados;
- Disponibilizar dashboard e relatório anual;
- Enviar notificações por e-mail;
- Manter um histórico amplo para auditoria;
- Preparar uma futura interoperabilidade com o SEI.

## Perfis envolvidos

- Professor solicitante;
- Chefe do departamento;
- Membro do Conselho Departamental;
- Responsável administrativo/financeiro.

Professor, chefe e conselheiro podem assumir o papel de solicitante. O responsável administrativo/financeiro não pode solicitar recursos. Um mesmo usuário poderá possuir mais de um perfil.

A resposta do cliente também menciona um “administrador do sistema” na configuração do limite. Ainda precisa ser confirmado se esse é um perfil separado e quais são exatamente suas permissões.

## Fluxo principal

1. Um solicitante cadastra o pedido, seu valor e sua finalidade;
2. O sistema verifica o limite acumulado do professor no período aplicável;
3. Se o acumulado permanecer dentro do limite, a solicitação é aprovada automaticamente;
4. Se o limite for ultrapassado, o chefe abre uma votação e define seu prazo;
5. Os conselheiros discutem e registram seus votos;
6. Ao final do prazo, o sistema consolida o resultado;
7. Uma solicitação aprovada transfere o valor de disponível para provisionado;
8. O chefe registra o pagamento ou a prestação de contas;
9. O valor efetivamente pago passa de provisionado para utilizado;
10. Cancelamentos ou diferenças devolvem ao disponível o valor que não for utilizado.

## Regras de negócio confirmadas

### Solicitações

- O solicitante pode editar e cancelar uma solicitação enquanto ela não estiver com o status `PAGO`;
- As finalidades pertencem a uma lista predefinida;
- Somente o chefe pode incluir novas finalidades;
- Os campos obrigatórios e anexos da solicitação ainda precisam ser confirmados.

### Limite acumulado

- O limite pode ser definido pelo administrador do sistema e/ou pelo chefe;
- O valor pode mudar ao longo do tempo;
- O limite é acumulado por professor dentro de um período;
- Uma nova solicitação deve ser submetida ao conselho quando a soma ultrapassar o limite;
- A duração do período e quais statuses entram no acumulado ainda precisam ser definidos.

### Votação

- A votação é iniciada pelo chefe;
- O chefe define o prazo e não existe prazo padrão;
- Não existe quórum mínimo;
- A decisão ocorre por maioria simples;
- Os votos possíveis são aprovação, rejeição e abstenção;
- O voto é público no processo de deliberação;
- Um voto registrado não pode ser alterado;
- O chefe não vota normalmente e registra apenas o voto de desempate;
- Comentários são visíveis somente aos conselheiros e ao chefe;
- Comentários permanecem no histórico;
- O solicitante não participa diretamente da discussão interna;
- O chefe pode solicitar que o docente complemente as informações editando o pedido.

### Provisionamento e pagamento

- A aprovação provisiona imediatamente o valor;
- O valor passa a utilizado quando o chefe registra o pagamento ou a prestação de contas;
- Não é obrigatório anexar comprovante para registrar o pagamento;
- Não existe uma validação adicional depois do registro do chefe;
- O valor pago pode ser diferente do valor provisionado;
- Uma diferença exige alteração pelo chefe e justificativa;
- Se uma solicitação aprovada for cancelada ou não for paga, o valor retorna ao disponível.

### Orçamento

- Existe um único saldo geral do departamento;
- O orçamento é cadastrado manualmente no início de cada ano;
- O saldo pode receber atualizações manuais ao longo do período;
- Não há divisão por categoria ou fonte de recurso;
- Não existe banco ou planilha anterior a ser importado neste momento.

### Dashboard e prestação de contas

O dashboard deve apresentar inicialmente:

- Total disponível;
- Total provisionado;
- Total utilizado;
- Valores utilizados por período;
- Quantidade de solicitações;
- Solicitações aprovadas, rejeitadas e pendentes;
- Professores que mais solicitaram recursos;
- Principais categorias ou finalidades.

O sistema deverá gerar um relatório anual do ano selecionado em PDF, organizado visualmente de acordo com os exemplos de documentos oficiais da UTFPR. Relatórios mensais, semestrais ou de períodos personalizados não fazem parte do escopo atual.

### Auditoria e comunicação

- Deve ser registrado o máximo possível sobre ações e alterações;
- O histórico deve identificar ator, ação, entidade, data e hora;
- Votos, mudanças de status, alterações de valor, pagamentos e justificativas devem ser auditáveis;
- O envio de notificações por e-mail é uma funcionalidade desejada;
- Os eventos e destinatários exatos de cada notificação ainda serão refinados.

## Solução técnica proposta

O sistema será desenvolvido em TypeScript de ponta a ponta, como um monólito modular. O backend será uma única aplicação Express organizada em módulos de negócio. Essa organização evita a complexidade operacional de microserviços e mantém separadas as responsabilidades do sistema.

### Stack

| Área | Tecnologia |
| --- | --- |
| Linguagem | TypeScript |
| Frontend | React com Vite |
| Rotas do frontend | React Router |
| Dados remotos | TanStack Query |
| Formulários | React Hook Form e Zod |
| Interface | Tailwind CSS e shadcn/ui |
| Backend | Node.js com Express |
| API | REST com OpenAPI/Swagger |
| Banco de dados | PostgreSQL |
| ORM | Prisma |
| Validação | Zod |
| E-mail | Nodemailer e SMTP |
| PDF | HTML/CSS e Playwright |
| Testes de backend | Vitest e Supertest |
| Testes de fluxo | Playwright |
| Monorepo | pnpm workspaces |
| Ambiente | Docker Compose |
| Integração contínua | GitHub Actions |

### Visão da arquitetura

```text
Navegador
    │
    ▼
React + Vite
    │ REST / JSON
    ▼
Express — monólito modular
    ├── PostgreSQL
    ├── SMTP
    ├── armazenamento de anexos
    └── geração de PDF

Futuro:
Express → tarefa persistida → worker Playwright → SEI
```

### Módulos previstos

- Autenticação;
- Usuários e perfis;
- Orçamento;
- Categorias de despesa;
- Solicitações;
- Votações;
- Comentários;
- Pagamentos;
- Notificações;
- Relatórios;
- Anexos;
- Auditoria.

### Estrutura inicial planejada

```text
apps/
    api/
        src/
            modules/
            middlewares/
            jobs/
            config/
            database/
    web/
        src/
            features/
            components/
            pages/
            services/
tests/
    e2e/
docs/
    requirements/
    architecture/
    prototypes/
infra/
compose.yaml
pnpm-workspace.yaml
```

Essa estrutura é uma proposta inicial e deverá ser criada gradualmente, conforme as primeiras funcionalidades forem implementadas.

## Entrada, saída e interoperabilidade

### Entradas

- Formulários preenchidos pelos usuários;
- Cadastro e atualização manual do orçamento;
- Votos e comentários dos conselheiros;
- Registro de pagamentos e justificativas pelo chefe;
- Possíveis documentos anexados às solicitações.

### Saídas

- Dashboard;
- Histórico e acompanhamento das solicitações;
- Notificações por e-mail;
- Relatório anual em PDF;
- Registros de auditoria.

### Integrações

- SMTP para envio de e-mails;
- Futuramente, RPA com Playwright para integração com o SEI;
- Não existe integração financeira ou importação de base legada no escopo atual.

## Ambientes colaborativos

- **Código e revisão:** GitHub, neste repositório;
- **Tarefas:** GitHub Projects é a ferramenta proposta, ainda pendente de configuração;
- **Documento da Fase 1:** ambiente compartilhado ainda pendente de definição;
- **Protótipos:** Figma é a ferramenta proposta, ainda pendente de configuração;
- **Comunicação:** canal do grupo ainda pendente de registro no documento da Fase 1.

Os endereços, responsáveis e dados de acesso deverão ser adicionados aqui depois que os ambientes estiverem configurados.

## Fase 1

A primeira entrega deverá conter:

- Entendimento do negócio;
- Requisitos levantados com o cliente;
- Fluxo proposto;
- Rascunhos e protótipos das telas;
- Arquitetura e stack;
- Estratégia de entrada, saída e interoperabilidade;
- Ambientes colaborativos configurados;
- Hierarquia e divisão de responsabilidades da equipe;
- Tarefas planejadas para as próximas fases;
- Link para um vídeo coletivo de apresentação.

Todos os cinco integrantes devem aparecer e apresentar uma parte da proposta. A referência de duração fornecida para o vídeo é de aproximadamente 10 a 15 minutos.

## Pontos pendentes com o cliente

- Qual é a duração exata do período usado no limite acumulado?
- Quais solicitações entram no acumulado: pendentes, aprovadas, provisionadas, pagas ou canceladas?
- Uma edição após aprovação exige nova análise ou votação?
- Quais campos e documentos são obrigatórios em uma solicitação?
- O que acontece se não houver votos até o encerramento do prazo?
- Como tratar maioria quando existem apenas abstenções?
- O que acontece quando não existe saldo suficiente para provisionar uma solicitação?
- Quais são as permissões do responsável administrativo/financeiro?
- Existe um administrador do sistema separado do chefe?
- As notificações também devem existir dentro da plataforma?
- Onde os anexos deverão ser armazenados no ambiente definitivo?

## Execução local

As instruções de instalação e execução serão adicionadas quando o frontend, o backend e o ambiente Docker forem inicializados.

## Documentação viva

Este README deverá ser atualizado conforme novas regras forem confirmadas, decisões técnicas forem tomadas e os ambientes do projeto forem configurados. Requisitos confirmados devem permanecer separados de hipóteses e pontos pendentes.
