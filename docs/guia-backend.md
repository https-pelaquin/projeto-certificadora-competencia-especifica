# Guia do backend (`apps/api`)

Guia de referência para integrantes e agentes que forem trabalhar na API. Explica como rodar o projeto, o papel de cada arquivo, as regras implementadas e os contratos entre módulos.

- Arquitetura e decisões: [`architecture/arquitetura.md`](architecture/arquitetura.md) e [`architecture/backend-processos.md`](architecture/backend-processos.md).
- Contrato HTTP sempre atualizado: Swagger UI em `http://localhost:3000/api/docs` (JSON em `/api/docs/openapi.json`).

## 1. Estado atual

| Frente | Situação |
| --- | --- |
| Banco de dados (todas as tabelas da arquitetura §8) | Pronto |
| Fundação da API (Express, env, erros, logs, CSRF) | Pronto |
| Autenticação, usuários, perfis com vigência, convites | Pronto (P2) |
| Auditoria (gravação e consulta) | Pronto (P2) |
| Notificações por e-mail (fila + rotina) | Pronto (P2) |
| Votações, desempate, comentários, rotina de encerramento | Pronto (P2) |
| Relatório anual em PDF | Pronto (P2), template provisório |
| OpenAPI + Swagger UI, Docker Compose, GitHub Actions | Pronto (P2) |
| Orçamento, saldo e limite (serviços) | Portado do código da P1, sem rotas HTTP |
| Solicitações, categorias, pagamentos, complementação, dashboard | **A fazer (P1)**: só existem os contratos usados pela votação |
| Frontend (`apps/web`) | A fazer (P3–P5) |

## 2. Como rodar

Pré-requisitos: Node.js 20.19+ (CI e Docker usam Node 24), Docker com Compose e Corepack (`corepack enable`, já vem com o Node). A versão do pnpm é fixada em `package.json` (`packageManager`).

### Desenvolvimento local (API fora do Docker)

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env       # preencher SESSION_SECRET e SEED_HEAD_*
docker compose up -d db mailpit               # PostgreSQL na 5433, Mailpit na 1025/8025
pnpm --filter api db:generate                 # gera o client do Prisma (apps/api/generated, fora do Git)
pnpm --filter api db:migrate                  # aplica as migrations
pnpm --filter api db:seed                     # cria o primeiro chefe a partir do .env
pnpm dev                                      # API em http://localhost:3000 com hot reload
```

### Tudo no Docker

```bash
cp apps/api/.env.example apps/api/.env
docker compose up --build                     # db + mailpit + api (migrations rodam no start)
docker compose exec api pnpm db:seed
```

### Endereços

| O quê | Onde |
| --- | --- |
| API | `http://localhost:3000/api` |
| Swagger UI | `http://localhost:3000/api/docs` |
| E-mails enviados (Mailpit) | `http://localhost:8025` |
| PostgreSQL | `localhost:5433`, usuário/senha/banco `dacom` |

### Comandos

| Comando (raiz) | Faz |
| --- | --- |
| `pnpm dev` | API com `tsx watch` |
| `pnpm test` | Testes Vitest (recria o banco `TEST_DATABASE_URL` antes da suíte) |
| `pnpm typecheck` | `tsc` sem emitir |
| `pnpm --filter api db:migrate` / `db:generate` / `db:seed` | Prisma |
| `pnpm --filter api exec prisma migrate dev --name <nome>` | Criar migration nova (em desenvolvimento) |

O teste do PDF precisa do Chromium do Playwright: `pnpm --filter api exec playwright install chromium-headless-shell` (no Linux do CI: `--with-deps`).

## 3. Variáveis de ambiente

Validadas no boot por `src/config/env.ts`: se faltar alguma, a API não sobe. Modelo em `apps/api/.env.example`.

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` (cookie `Secure` e `trust proxy` só em produção) |
| `PORT` | Porta HTTP (padrão 3000) |
| `DATABASE_URL` | PostgreSQL da aplicação |
| `TEST_DATABASE_URL` | Banco **apagado e recriado** a cada `pnpm test`. Nunca aponte para dados reais |
| `SESSION_SECRET` | Assinatura do cookie de sessão (mín. 32 caracteres; `openssl rand -hex 32`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envio de e-mail (Mailpit em dev) |
| `APP_URL` | URL do frontend usada nos links dos e-mails |
| `CORS_ORIGIN` | Origem do frontend liberada no CORS (com credenciais) |
| `BCRYPT_ROUNDS` | Opcional, padrão 12; os testes usam 4 |
| `SEED_HEAD_NAME`, `SEED_HEAD_EMAIL`, `SEED_HEAD_PASSWORD` | Só para `db:seed` |

## 4. Mapa de arquivos

```text
docker-compose.yml             db (PostgreSQL 17), mailpit e api
.github/workflows/ci.yml       CI: tipos, migrations, testes e auditoria de dependências
apps/api/
    Dockerfile                 imagem da API (Node 24 + Chromium do Playwright)
    prisma.config.ts           configuração do Prisma 7 (schema, migrations, DATABASE_URL)
    vitest.config.ts           testes: banco de teste, sem paralelismo entre arquivos
    prisma/
        schema.prisma          modelo de dados completo
        migrations/            SQL versionado (inclui CHECKs, triggers e constraints manuais)
        seed.ts                primeiro chefe
    src/
        server.ts              sobe o HTTP, as rotinas agendadas e o desligamento gracioso
        app.ts                 monta o Express (middlewares, rotas, Swagger, erros)
        config/env.ts          leitura e validação do process.env
        docs/openapi.ts        lista de rotas → documento OpenAPI 3.1 (a partir dos schemas Zod)
        jobs/index.ts          agenda closeExpiredVotings (60 s) e sendPendingEmails (30 s)
        middlewares/
            requestContext.ts      requestId por requisição + log de acesso
            requireJson.ts         exige application/json em requisições com corpo (CSRF)
            authenticate.ts        carrega req.user da sessão (perfis vigentes) e actorFrom(req)
            requirePermission.ts   checa permissões do mapa de perfis
            errorHandler.ts        converte erros em { error: { code, message } }
        shared/
            prisma.ts          PrismaClient (adapter pg) e o tipo Db = TransactionClient
            session.ts         express-session com store no PostgreSQL
            errors.ts          AppError e subclasses (401, 403, 404, 409, 422)
            actor.ts           tipo Actor (USER ou SYSTEM) usado na auditoria
            logger.ts          log técnico em JSON
            dates.ts           addMonths (janela do limite, mandato do chefe)
            schemas.ts         idParam, isoDateTime
        types/express.d.ts     req.user, req.requestId e session.userId
        modules/               um diretório por domínio (seção 6)
        test/                  infraestrutura de testes (global-setup, resetDatabase, factories)
        tests/app.test.ts      testes da fundação (health, 404, JSON, OpenAPI)
```

Padrão de cada módulo (`modules/<domínio>/`):

| Arquivo | Responsabilidade |
| --- | --- |
| `<d>.routes.ts` | Rotas + `authenticate` + `requirePermission` |
| `<d>.controller.ts` | Valida a entrada com Zod, chama o service e monta a resposta. Sem regra de negócio |
| `<d>.service.ts` | Regras, transações, auditoria e e-mails |
| `<d>.repository.ts` | Consultas Prisma/SQL; recebe `db` (cliente ou `tx`) |
| `<d>.schemas.ts` | Schemas Zod de entrada (também alimentam o OpenAPI) |
| `tests/` | Testes do módulo |

## 5. Convenções que todo código novo deve seguir

- **Transação única.** Serviços que alteram dados abrem `prisma.$transaction(async (tx) => …)` e passam o mesmo `tx` a repositórios e a outros serviços. Ação, auditoria e e-mail entram juntos ou não entram.
- **Dentro de `tx`, consultas em sequência.** Não use `Promise.all` com o mesmo `tx`: o driver `pg` não executa consultas paralelas numa conexão.
- **Um módulo chama o service de outro módulo**, nunca o repositório dele.
- **Auditoria:** `audit.record(tx, actor, { action, entityType, entityId, before?, after?, justification? })`. O `actor` vem de `actorFrom(req)` nas rotas ou de `{ type: "SYSTEM", job }` nas rotinas. Os campos `passwordHash`, `password`, `tokenHash` e `token` são removidos automaticamente.
- **E-mail:** `notifications.enqueue(tx, { template, to, dedupeKey, data })`. Os templates ficam em `notifications.templates.ts` (tipados). A `dedupeKey` deve identificar o evento (ex.: `voting-opened:<votingId>:<userId>`): repetir a chave não duplica o envio.
- **Erros:** lance `NotFoundError`, `ConflictError` (estado inválido ou duplicado), `BusinessRuleError` (422) ou `ForbiddenError`. Não monte respostas de erro à mão.
- **Tempo:** funções com regra de prazo recebem `now` como parâmetro (padrão `new Date()`), para os testes controlarem o relógio.
- **Ordem de locks:** `Request` → `Voting` → `Budget`. Quem precisar travar mais de uma linha segue essa ordem, o que evita deadlock entre votação, cancelamento e provisionamento.
- **Dinheiro:** `Prisma.Decimal` em todo cálculo; nunca `number`.
- **Permissões:** as rotas checam permissões (`requirePermission("votings:open")`), nunca perfis. O mapa fica em `modules/auth/permissions.ts`. Regras que dependem do dado (convocado, solicitante, chefe vigente) ficam no service.

## 6. Funcionalidades por módulo

### 6.1 `auth` — autenticação

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `POST /api/auth/login` | público | `{ email, password }` → 204 e cookie `dacom.sid` |
| `POST /api/auth/logout` | público | Encerra a sessão |
| `GET /api/auth/me` | logado | `{ id, name, email, roles, permissions }` |
| `POST /api/auth/password/forgot` | público | Sempre 204; se o e-mail existir, envia link de redefinição (válido por 1 h) |
| `POST /api/auth/password/reset` | público | `{ token, password }`: aceita o convite (7 dias) ou redefine a senha |

Regras:
- sessão no PostgreSQL (tabela `session`), 8 h por inatividade, id regenerado no login;
- bcrypt com custo 12;
- 10 tentativas falhas por IP a cada 15 min (depois, 429) e mensagem genérica de falha;
- tokens guardados só como SHA-256, de uso único. Definir a senha invalida os outros tokens abertos e derruba as sessões do usuário;
- usuário e perfis vigentes são lidos do banco a cada requisição.

Arquivos: `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` (login, tokens, reset), `auth.repository.ts` (tokens e sessões), `auth.schemas.ts` (e-mail normalizado, senha de 8 a 72 caracteres) e `permissions.ts` (mapa perfil → permissões).

### 6.2 `users` — usuários e perfis

Todas as rotas exigem `users:manage` (hoje, só o chefe).

| Rota | O que faz |
| --- | --- |
| `GET /api/users` / `GET /api/users/:id` | Lista/detalha com perfis vigentes e histórico de atribuições |
| `POST /api/users` | `{ name, email, roles[] }`: cria sem senha, atribui os perfis e envia o convite |
| `PATCH /api/users/:id` | `{ name?, active? }`: desativar revoga as sessões; ninguém desativa a si mesmo |
| `POST /api/users/:id/invite` | Reenvia um convite pendente |
| `POST /api/users/:id/roles` | `{ role, startsAt?, endsAt? }`: chefe sem `endsAt` recebe mandato de 2 anos |
| `POST /api/users/:id/roles/:assignmentId/end` | `{ endsAt? }`: encerra a atribuição (só antecipa; nunca apaga) |

Garantias:
- e-mail único, sempre em minúsculas;
- usuário nunca é apagado;
- não há dois chefes com vigência sobreposta (checagem no service **e** constraint `RoleAssignment_single_head` no banco);
- o mesmo usuário não recebe o mesmo perfil em períodos sobrepostos.

### 6.3 `audit` — auditoria

- `audit.record(...)` (ver §5). A tabela `AuditLog` recusa `UPDATE`/`DELETE` por trigger.
- `GET /api/audit-logs` (`audit:read`): filtros `actorId`, `action`, `entityType`, `entityId`, `from`, `to` (ISO 8601), `page` e `pageSize` (até 100). Resposta `{ items, page, pageSize, total }`.
- Ações gravadas hoje:
  - acesso: `LOGIN`, `INVITE_ACCEPTED`, `PASSWORD_RESET`;
  - usuários: `USER_INVITED`, `INVITE_RESENT`, `USER_UPDATED`, `ROLE_ASSIGNED`, `ROLE_ENDED`, `USER_SEEDED`;
  - financeiro: `BUDGET_CREATED`, `BUDGET_ADJUSTED`, `APPROVAL_LIMIT_CREATED`, `REQUEST_STATUS_CHANGED`;
  - votação: `VOTING_OPENED`, `VOTE_CAST`, `VOTING_TIED`, `TIE_BREAK_CAST`, `VOTING_CLOSED`, `VOTING_CANCELED`, `VOTING_COMMENT_ADDED`;
  - relatórios: `REPORT_GENERATED`.

### 6.4 `notifications` — e-mails

- A tabela `EmailOutbox` é a fila.
- `sendPendingEmails(now)` roda a cada 30 s:
  - pega até 20 pendentes com `FOR UPDATE SKIP LOCKED` e envia via Nodemailer;
  - reagenda as falhas em 1 min, 5 min, 30 min, 2 h e 12 h;
  - na 6ª falha, marca `FAILED` e guarda o erro em `lastError`.
- Garantia "pelo menos uma vez": se o processo cair entre o envio e o commit, o e-mail pode sair duas vezes.
- Templates: `INVITE`, `PASSWORD_RESET`, `VOTING_OPENED`, `VOTING_TIE`, `VOTING_CLOSED`. Para criar outro, adicione o tipo em `EmailMessage` e o `case` em `render()`.

### 6.5 `votings` — votações do conselho

| Rota | Permissão | O que faz |
| --- | --- | --- |
| `POST /api/requests/:requestId/votings` | `votings:open` | `{ deadline }`: abre votação de uma solicitação `AWAITING_VOTING` |
| `GET /api/votings?status=` | logado | Chefe e leitura geral veem todas; os demais, só aquelas em que foram convocados ou que solicitaram |
| `GET /api/votings/:id` | logado | Convocados e chefe: votos nominais, contagem e desempate. Solicitante e leitura geral: só situação e resultado |
| `POST /api/votings/:id/votes` | `votings:vote` | `{ choice: APPROVE \| REJECT \| ABSTAIN }` |
| `POST /api/votings/:id/tie-break` | `votings:tieBreak` | `{ choice: APPROVE \| REJECT }` |
| `GET/POST /api/votings/:id/comments` | `votings:comment` | `{ body }` com até 2.000 caracteres |

Fluxo e regras:

1. **Abrir:** grava os convocados (conselheiros ativos, exceto o chefe vigente e o solicitante). Sem convocados, responde 422. A solicitação vai para `IN_VOTING` e os convocados recebem e-mail.
2. **Votar:** só convocados, com a votação `OPEN` e antes do prazo. Um voto por pessoa (PK no banco; segundo voto → 409). Não há alteração de voto nem encerramento antecipado.
3. **Encerrar:** a rotina `closeExpiredVotings` (a cada 60 s) apura as votações vencidas. A abstenção não conta e a maioria simples decide. **Qualquer empate, inclusive 0×0, vai para `AWAITING_TIE_BREAK`** e o chefe recebe e-mail. A rotina é idempotente: rodar duas vezes não provisiona duas vezes.
4. **Desempatar:** o chefe registra uma única decisão (`TieBreak`), que encerra a votação.
5. **Resultado:** `requests.applyVotingResult`. Aprovada provisiona no ledger se houver saldo, senão vai para `AWAITING_BALANCE`; rejeitada vai para `REJECTED`. Solicitante e convocados recebem e-mail.
6. **Comentários:** só convocados e chefe, nunca o solicitante, e só enquanto a votação está ativa. Comentários nunca são editados ou apagados.

### 6.6 `reports` — relatório anual

`GET /api/reports/annual/:year.pdf` (`reports:read`).

- Usa `budget.getAnnualSummary(year)` e monta o HTML em `reports.template.ts`, escapando o texto do usuário.
- Converte com Playwright Chromium: navegador reaproveitado, contexto novo por relatório, timeout de 30 s.
- Ano sem orçamento → 404.
- **Template provisório** até chegar o modelo oficial da UTFPR.

### 6.7 `budget` e `requests` — código da Pessoa 1 e contratos

Portado do código original da P1 (mesmas regras, nomes em inglês):

- `budget.service.ts`: `createBudget`, `adjustBudget` (exige justificativa; o ajuste negativo não deixa o disponível negativo), `getBalance` (disponível/provisionado/utilizado derivados do ledger), `lockBudget`, `tryProvision` e `getAnnualSummary`.
- `approval-limit.service.ts`: `createLimit` (encerra o limite vigente) e `checkLimit` (janela móvel de `periodMonths`).
- `requests.service.ts`: `STATUSES_COUNTED_IN_LIMIT` e os contratos da votação: `getForVoting` (trava a solicitação), `markInVoting` e `applyVotingResult`.

Contratos da P2 que a P1 deve usar:

- `audit.record(tx, actor, …)` em toda mudança financeira e de status;
- `notifications.enqueue(tx, …)` para aprovação automática, pagamento e cancelamento (os templates ainda precisam ser criados);
- `votings.cancelForRequest(tx, requestId, actor)` ao cancelar uma solicitação, chamado com a solicitação já travada por `getForVoting`;
- `actorFrom(req)`, `authenticate` e `requirePermission(...)` nas rotas.

Ainda falta (P1):
- rotas de orçamento e limite;
- CRUD de solicitações com avaliação automática (`checkLimit` + `tryProvision` sob `lockBudget`);
- complementação (`ComplementRequest`);
- cancelamento com `RELEASE`;
- pagamentos com diferença justificada;
- categorias e dashboard.

## 7. Banco de dados

Schema em `prisma/schema.prisma`. Convenções: nomes em inglês, `Decimal(14,2)` para dinheiro, `Timestamptz(3)` (UTC) e IDs inteiros.

Regras garantidas pelo próprio banco (SQL nas migrations):

| Regra | Mecanismo |
| --- | --- |
| Valores > 0 (orçamento ≥ 0) | `CHECK` em `Budget`, `ApprovalLimit`, `Request`, `LedgerEntry` e `Payment` |
| Ledger e auditoria só de inclusão | Trigger `reject_update_delete` em `LedgerEntry` e `AuditLog` |
| Uma votação ativa por solicitação | Índice único parcial `Voting_requestId_active_key` |
| Um voto por convocado | PK `(votingId, userId)` em `Vote` + FK para `VotingEligibleMember` |
| Um desempate por votação | PK `votingId` em `TieBreak` |
| Um pagamento por solicitação | Unique `Payment.requestId` |
| Um chefe por vez | Constraint de exclusão `RoleAssignment_single_head` (`tstzrange` + GiST) |
| Fim de vigência ≥ início | `CHECK` em `RoleAssignment` |
| E-mail sem duplicata | Unique `EmailOutbox.dedupeKey` |
| Histórico não é apagado | FKs `ON DELETE RESTRICT` |

Para alterar o schema:
1. Edite `schema.prisma`.
2. Rode `pnpm --filter api exec prisma migrate dev --name <nome>` e confira o SQL gerado.
3. Regras que o Prisma não expressa (CHECK, trigger, índice parcial, exclusão) entram à mão no `migration.sql`.
4. Para conferir que banco e schema batem: `pnpm --filter api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`.

## 8. Para o frontend

- A autenticação é por cookie: use `credentials: "include"` no fetch. Em desenvolvimento, use o proxy do Vite para `/api` (mesma origem); o CORS aceita apenas `CORS_ORIGIN`.
- Toda requisição com corpo deve enviar `Content-Type: application/json` (senão, 415).
- Erros chegam como `{ error: { code, message, details? } }`, com `message` já em pt-BR. Códigos:
  - `VALIDATION_ERROR` (400, com `details[{ path, message }]`);
  - `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404);
  - `CONFLICT` (409), `BUSINESS_RULE` (422);
  - `UNSUPPORTED_MEDIA_TYPE` (415), `TOO_MANY_REQUESTS` (429);
  - `INTERNAL_ERROR` (500, com o código da requisição).
- `GET /api/auth/me` devolve `permissions`: use para mostrar ou esconder ações. O backend continua validando.
- Os e-mails já enviam links para três rotas que o frontend precisa implementar: `/definir-senha?token=…` (chama `POST /api/auth/password/reset`), `/votacoes/:id` e `/solicitacoes/:id`.
- Datas chegam em ISO 8601 UTC; valores monetários chegam como string decimal (`"1500.00"`).

## 9. Testes

- `pnpm test` recria o banco de `TEST_DATABASE_URL`, aplica as migrations e roda os arquivos em sequência. Cada teste começa com `resetDatabase()` (TRUNCATE de todas as tabelas).
- São testes de integração de verdade: Supertest contra o app Express e PostgreSQL real, sem mock do banco.
- Factories em `src/test/factories.ts`: `createUser({ roles })`, `loginAs(app, user)` (agente com cookie) e `createRequest({ requesterId, status })`.
- Regras de risco da P2 cobertas:
  - votação: voto duplo (409), voto após o prazo (422), não convocado e solicitante (403), rotina de encerramento 2× → uma provisão, empate → desempate, só abstenções, comentários invisíveis ao solicitante;
  - acesso: 403 por perfil, revogação de sessão, tokens de uso único e com expiração;
  - auditoria: rollback desfaz a auditoria, trigger bloqueia `UPDATE`/`DELETE`;
  - e-mail: deduplicação e retry;
  - relatório: PDF começa com `%PDF`.
- **WSL2:** o relógio do WSL às vezes volta dezenas de segundos, então os testes usam datas fixas no passado. Se notar horários estranhos, `sudo hwclock -s` (ou `wsl --shutdown` no Windows) ressincroniza.

## 10. Diferenças em relação ao documento de arquitetura

| Arquitetura | Implementado | Motivo |
| --- | --- | --- |
| `.env.example` na raiz | `apps/api/.env.example` | É onde a API, o Prisma e o Compose leem o `.env` |
| Lista de campos **permitidos** na auditoria | Lista de campos **proibidos** (segredos) | Os chamadores já passam snapshots curados; evita manter uma lista por entidade |
| Um chefe por vez só no service | Service + constraint de exclusão no banco | Cobre a corrida entre duas atribuições simultâneas |
| Lint no CI | Ainda sem ESLint | O grupo não definiu configuração de lint |
| Biblioteca Zod→OpenAPI | `z.toJSONSchema` nativo do Zod 4 | Sem dependência extra |
| `SYSTEM` sem campo próprio | `AuditLog.job` guarda o nome da rotina | Rastrear qual rotina agiu |

## 11. Pendências com o cliente que afetam este código

Os padrões provisórios ficam isolados e marcados com `[VALIDAR]` no código:

- empate 0×0 e só abstenções → desempate do chefe (`tallyResult` em `votings.service.ts`);
- aprovação sem saldo → `AWAITING_BALANCE` (`applyVotingResult`);
- status que entram no limite acumulado (`STATUSES_COUNTED_IN_LIMIT`);
- sem administrador do sistema; responsável financeiro só lê (`permissions.ts`);
- visibilidade dos votos para quem não é convocado (`getVoting`);
- modelo oficial do PDF (`reports.template.ts`).

## 12. Checklist para um módulo novo

1. Criar `modules/<d>/` com routes, controller, service, repository e schemas (só os arquivos necessários).
2. Registrar o router em `app.ts` e as operações em `docs/openapi.ts`.
3. Usar `authenticate` + `requirePermission`; incluir a permissão em `permissions.ts` se ela for nova.
4. Fazer toda alteração em transação, com `audit.record` e, se houver aviso, `notifications.enqueue`.
5. Escrever os testes em `modules/<d>/tests/` com `resetDatabase` e as factories.
6. Rodar `pnpm typecheck && pnpm test` antes do PR.
