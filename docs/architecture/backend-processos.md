# Arquitetura do backend de processos (Pessoa 2)

> **Status: aprovado pelo grupo e implementado** (2026-10-25). Guia do código: [`../guia-backend.md`](../guia-backend.md).
>
> | Parte | Conteúdo | Situação |
> | --- | --- | --- |
> | Decisões-base | Autenticação, convocação, apuração, rotinas, auditoria, contas | Aprovadas por Bruno em 2026-10-14 |
> | A | Mapa dos módulos e identidade/acesso | Aprovada em 2026-10-14 |
> | B | Deliberação (votação, desempate, comentários) | Aprovada em 2026-10-14; ajustada em 2026-10-17 (complementação foi para `requests`) |
> | C | Auditoria, notificações, PDF, OpenAPI, Docker, CI, erros e testes | Aprovada em 2026-10-17 |
>
> Visão do sistema inteiro, modelo de dados completo (diagrama ER) e regras financeiras: [`arquitetura.md`](arquitetura.md). Nomes de models e enums seguem aquele documento.

Escopo: módulos `auth`, `users`, `votings` (inclui comentários), `audit`, `notifications` e `reports`, além de OpenAPI, Docker Compose e GitHub Actions. O módulo financeiro (Pessoa 1) aparece apenas como contratos.

---

## 1. Decisões-base (aprovadas)

| Tema | Decisão | Alternativas descartadas |
| --- | --- | --- |
| Autenticação | Sessão no servidor (`express-session` + tabela no PostgreSQL), cookie `httpOnly` + `SameSite=Lax` | JWT em cookie (refresh exige tabela de qualquer forma); JWT em header (exposto a XSS, revogação difícil) |
| Convocação | Todos os conselheiros ativos, com **lista gravada na abertura** | Chefe seleciona (regra não confirmada); vigência no momento do voto (eleitorado muda durante a votação) |
| Apuração | Aprovar × rejeitar; abstenção não conta; **qualquer empate, inclusive 0×0, vai ao desempate do chefe** — padrão provisório até o cliente confirmar | 0×0 rejeita; 0×0 exige reabertura |
| Rotinas agendadas | Dentro do processo da API, lendo estado persistido, com `FOR UPDATE SKIP LOCKED` | Worker separado; biblioteca de fila (pg-boss) |
| Auditoria | Chamada explícita `audit.record(tx, ...)` no service, na mesma transação | Triggers genéricos; extensão automática do Prisma |
| Contas | Convite por e-mail com link de uso único; mesmo mecanismo para redefinir senha; primeiro gestor via seed | Senha temporária pelo gestor; autocadastro com aprovação |

---

## 2. Parte A — Mapa dos módulos e identidade/acesso (aprovada)

### 2.1 Módulos (`apps/api/src/modules/`)

| Módulo | Responsabilidade |
| --- | --- |
| `auth` | Login, logout, `me`, definir/redefinir senha por token |
| `users` | Usuários, atribuições de perfil com vigência, convites |
| `votings` | Votação, votos, desempate, comentários, apuração |
| `audit` | Gravar e consultar auditoria |
| `notifications` | Fila de e-mails e envio |
| `reports` | Relatório anual em PDF |

Comentários ficam dentro de `votings` porque só existem no contexto de uma votação.

Compartilhados: `middlewares/` (`authenticate`, `requirePermission`, `requestContext` com IP e request id, `errorHandler`) e `jobs/`.

### 2.2 Contratos com a Pessoa 1

Pessoa 2 fornece:
- `audit.record(tx, actor, entry)`;
- `notifications.enqueue(tx, message)`;
- `req.user = { id, roles }` e `requirePermission(...)`.

Pessoa 1 fornece:
- `requests.getForVoting(tx, id)`;
- `requests.markInVoting(tx, id, actor)`;
- `requests.applyVotingResult(tx, id, 'APPROVED' | 'REJECTED', actor)` — provisiona no ledger quando aprovado;
- `budget.getAnnualSummary(year)` — totais e solicitações do ano (usado pelo relatório).

Todas as operações relacionadas recebem o mesmo `tx`: voto → resultado → provisionamento → auditoria → e-mail é uma transação.

> **A combinar com a Pessoa 1:** assinaturas exatas e o formato de `actor`.

### 2.3 Perfis e permissões

- Perfis: `PROFESSOR`, `HEAD`, `COUNCIL_MEMBER`, `FINANCIAL_ADMIN`.
- Rotas checam **permissões** (`users:manage`, `votings:open`, `votings:vote`, `votings:tieBreak`, `votings:comment`, `audit:read`, `reports:read`…), não perfis.
- Um único arquivo mapeia perfil → permissões. Hoje `users:manage`, `audit:read` e `reports:read` ficam com `HEAD`. Se o cliente confirmar `SYSTEM_ADMIN` ou as permissões do `FINANCIAL_ADMIN`, muda só o mapa.
- Regras que dependem do dado (ex.: estar na lista de convocados) ficam no service.

### 2.4 Modelo de dados

Campos completos no diagrama de [`arquitetura.md`](arquitetura.md#8-modelo-de-dados).

- `User`: `email` único e minúsculo; `passwordHash` nulo até aceitar o convite; desativado, nunca apagado.
- `RoleAssignment`: nunca é apagado; encerrar = preencher `endsAt` (auditado). O service impede dois `HEAD` com vigência sobreposta.
- `PasswordToken`: só o hash é guardado; uso único; `purpose` `INVITE`/`RESET`.
- `Session`: formato do `connect-pg-simple`.

### 2.5 Autenticação

- Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção, expiração por inatividade (~8 h).
- Regenerar o id da sessão no login (fixação de sessão).
- Usuário e perfis vigentes lidos do banco a cada requisição → desativação e fim de perfil têm efeito imediato.
- Senhas com bcrypt (custo 12); limite de tentativas no login.
- CSRF: `SameSite=Lax` + API só aceita JSON + CORS restrito à origem do frontend.
- Desenvolvimento: proxy do Vite para `/api` (mesma origem).
- "Esqueci a senha" sempre responde 200 (não revela e-mails cadastrados).

### 2.6 Rotas

```text
POST /api/auth/login        POST /api/auth/logout       GET /api/auth/me
POST /api/auth/password/forgot                         POST /api/auth/password/reset
GET  /api/users             POST /api/users (convida)   PATCH /api/users/:id
POST /api/users/:id/roles   POST /api/users/:id/roles/:assignmentId/end
```

---

## 3. Parte B — Deliberação (aprovada)

### 3.1 Estados

```text
Solicitação (Pessoa 1): AWAITING_VOTING ──abrir──► IN_VOTING ──► PROVISIONED | AWAITING_BALANCE (aprovada sem saldo) | REJECTED

Votação:  OPEN ──prazo vence──► apuração ──┬─ aprovar > rejeitar ─► CLOSED (APPROVED)
                                           ├─ rejeitar > aprovar ─► CLOSED (REJECTED)
                                           └─ empate (inclui 0×0) ─► AWAITING_TIE_BREAK ──chefe──► CLOSED
          OPEN | AWAITING_TIE_BREAK ──solicitação cancelada──► CANCELED (votos e comentários preservados)
```

### 3.2 Modelo de dados

- `Voting`: `deadline` em timestamptz UTC; `approveCount`, `rejectCount` e `abstainCount` gravados no encerramento. Índice único parcial: no máximo uma votação não encerrada por solicitação; histórico preservado.
- `VotingEligibleMember (votingId, userId)`: lista gravada na abertura.
- `Vote (votingId, userId, choice, createdAt)`: PK `(votingId, userId)`; FK `(votingId, userId)` → `VotingEligibleMember`.
- `TieBreak (votingId PK, headId, choice)`: `choice` só `APPROVE`/`REJECT`.
- `VotingComment (id, votingId, authorId, body, createdAt)`: só inclusão.

### 3.3 Regras

- **Abrir** (`votings:open`): solicitação em `AWAITING_VOTING`; prazo futuro; grava os conselheiros ativos **excluindo o chefe e o solicitante**; lista vazia → 422. Na transação: `requests.markInVoting`, auditoria e e-mails aos convocados.
- **Votar** (`votings:vote`): `OPEN`, `now < deadline`, usuário convocado; auditoria `VOTE_CAST`; segundo voto → 409; sem rota de alteração. Sem encerramento antecipado.
- **Apurar:** função pura `tallyResult({ approve, reject })` → `APPROVED | REJECTED | TIE`.
- **Encerrar** (rotina a cada 60 s): `OPEN` com `deadline <= now()` via `FOR UPDATE SKIP LOCKED`; resultado definitivo → `CLOSED` + `requests.applyVotingResult`; empate → `AWAITING_TIE_BREAK` + e-mail ao chefe. Idempotente.
- **Desempatar** (`votings:tieBreak`, chefe vigente): `AWAITING_TIE_BREAK` → `TieBreak` → `CLOSED` → `applyVotingResult`, numa transação.
- **Comentários:** ler/escrever só convocados + chefe vigente; nunca o solicitante; escrita em `OPEN` e `AWAITING_TIE_BREAK`; até 2.000 caracteres; só inclusão.
- **Pedir complementação:** pertence ao módulo `requests` (Pessoa 1), porque também ocorre antes da votação e muda o status (`ComplementRequest`, `POST /api/requests/:id/complement-requests`). Durante a votação, o status não muda e o valor fica travado.
- **Visibilidade:** votos nominais visíveis aos convocados e ao chefe; o solicitante vê só o resultado.

### 3.4 Rotas

```text
POST /api/requests/:requestId/votings          { deadline }
GET  /api/votings?status=                      GET /api/votings/:id
POST /api/votings/:id/votes                    { choice: APPROVE | REJECT | ABSTAIN }
POST /api/votings/:id/tie-break                { choice: APPROVE | REJECT }
GET  /api/votings/:id/comments                 POST /api/votings/:id/comments
```

Erros: 403 sem permissão ou não convocado; 409 voto repetido ou status inválido; 422 prazo vencido ou dados inválidos.

### 3.5 Interpretações a validar com o cliente

- Solicitante que é conselheiro fica fora da votação do próprio pedido.
- "Voto público" = visível dentro da deliberação, não ao solicitante.
- Empate 0×0 vai ao desempate do chefe.
- Valor travado enquanto `IN_VOTING` (só o texto pode ser complementado) — incorporado em `arquitetura.md` §6.

---

## 4. Parte C — Serviços transversais, infraestrutura e testes (aprovada)

### 4.1 Auditoria

- `AuditLog`: campos no diagrama de `arquitetura.md`; `before`/`after` em jsonb. Índices por entidade, ator e data.
- Trigger no banco recusa `UPDATE`/`DELETE`.
- `audit.record(tx, actor, { action, entity, before?, after?, justification? })`; `actor` explícito (`USER` com id/IP/requestId ou `SYSTEM` + nome da rotina).
- `before`/`after` passam por lista de campos permitidos (nunca hash de senha ou token).
- `GET /api/audit-logs?actorId&action&entityType&entityId&from&to&page` (`audit:read`).
- Log técnico separado: JSON estruturado com `requestId` no stdout.

### 4.2 Notificações

- `EmailOutbox`: `dedupeKey` único; `status` `PENDING`/`SENT`/`FAILED`; `attempts`, `nextAttemptAt`, `lastError`, `sentAt`.
- `enqueue(tx, { template, to, data, dedupeKey })` com `ON CONFLICT ("dedupeKey") DO NOTHING`.
- Rotina a cada 30 s: até 20 pendentes via `FOR UPDATE SKIP LOCKED`, envio com Nodemailer; retry em 1 min, 5 min, 30 min, 2 h, 12 h; depois `FAILED`.
- Garantia "pelo menos uma vez" (duplicação rara aceita).
- Templates: funções TypeScript em pt-BR (assunto, HTML, texto).
- Eventos iniciais — Pessoa 2: convite, redefinição de senha, votação aberta, complementação, empate, votação encerrada. Pessoa 1: aprovação automática, pagamento, cancelamento. Lista final depende do cliente.

### 4.3 Relatório anual em PDF

- `GET /api/reports/annual/:year.pdf` (`reports:read`).
- `budget.getAnnualSummary(year)` → HTML por função TypeScript (escapando texto do usuário) → Playwright Chromium `page.setContent` + `page.pdf({ format: 'A4' })`.
- Navegador reaproveitado, contexto novo por relatório, timeout 30 s, auditoria `REPORT_GENERATED`.
- Trade-off: imagem da API maior por causa do Chromium.

### 4.4 OpenAPI

- Schemas Zod (`*.schemas.ts`) como fonte única → gerador Zod→OpenAPI (biblioteca e compatibilidade com a versão do Zod confirmadas na fundação) → Swagger UI em `/api/docs`.

### 4.5 Docker Compose (desenvolvimento)

- `postgres` (versão fixada, volume, healthcheck), `mailpit` (SMTP falso com UI), `api` e `web` com hot reload.
- `.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_URL`, `CORS_ORIGIN`.
- Node LTS vigente fixado em `engines`. Produção fica para a estabilização.

### 4.6 GitHub Actions

- Em PR e push na `main`: checkout → pnpm/Node com cache → `install --frozen-lockfile` → lint → tipos → migrações em PostgreSQL de serviço → testes → build.
- E2E Playwright em job separado (Pessoa 5).
- `main` protegida: CI verde + 1 aprovação de outra pessoa.

### 4.7 Tratamento de erros

- Erros de domínio com código; `errorHandler` traduz: Zod → 400, permissão → 403, não encontrado → 404, conflito/estado (inclui Prisma `P2002`) → 409, regra de negócio → 422, desconhecido → 500 com `requestId`.
- Resposta: `{ error: { code, message } }`, mensagem em pt-BR.

### 4.8 Testes

- **Unitários (Vitest):** `tallyResult` (inclui 0×0 e só abstenções), mapa de permissões, espera entre tentativas.
- **Integração (Vitest + Supertest + PostgreSQL real):** login/logout/revogação; 403 por perfil; voto duplo 409; voto após prazo 422; não convocado e solicitante 403; rotina de encerramento 2× → um provisionamento; empate → desempate → encerrada; comentários invisíveis ao solicitante; falha forçada desfaz ação e auditoria; trigger bloqueia `UPDATE` em `AuditLog`; deduplicação da fila; retry com SMTP simulado.
- **Relatório:** PDF gerado começa com `%PDF`.
- Rotinas recebem `now` como parâmetro (`closeExpiredVotings(now)`).

---

## 5. Pendências para fechar este documento

- Combinar com a Pessoa 1 os contratos da seção 2.2 e o alinhamento do código (`arquitetura.md` §13).
- Levar ao cliente as interpretações da seção 3.5 e as pendências de `arquitetura.md` §14.
- Validar com o grupo antes de registrar as decisões no `README.md`.
