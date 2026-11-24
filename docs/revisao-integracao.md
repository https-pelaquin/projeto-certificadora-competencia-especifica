# Revisão de integração — 2026-11-24

Revisão do `main` depois dos PRs #1–#4 e do PR #5 (aberto). Objetivo: listar o que impede o sistema de rodar de ponta a ponta com a API real e o que precisa de ajuste em cada frente.

Legenda de prioridade: **C** crítico (quebra o fluxo real) · **A** alto · **M** médio · **B** baixo · ✅ corrigido na branch `fix/processos-integracao`. `[VALIDAR]` = depende do cliente.

## Estado verificado

| Check | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | ok |
| API: `typecheck` | ok (exige `prisma generate` antes; uma pasta `generated/prisma` pela metade quebra o generate: apagar e gerar de novo) |
| API: `pnpm test` | **213/213** |
| Web: `tsc -b`, `oxlint`, `vite build` | ok (avisos de fast-refresh e bundle > 500 kB) |
| API + web (`VITE_ENABLE_MSW=false`) | sobe; login real via proxy do Vite funciona |
| CI (GitHub Actions) | verde, mas **não checa o web** |
| PR #5 | conflito aditivo em `App.tsx` e `pages/index.ts`; resolvido e enviado (merge de `main` na branch), PR mergeável |

**Resumo:** o backend está sólido (dinheiro em `Decimal`, saldo derivado do ledger, locks e idempotência corretos). O frontend só funciona de verdade nas telas da P4; as telas da P3 e a gestão de usuários foram feitas contra o mock e divergem do contrato da API. O MSW vem ligado por padrão e esconde essas divergências.

## Infra / transversal (P2 coordena)

| # | P | Item | Correção |
| --- | --- | --- | --- |
| I1 | ✅ | `apps/web/.env.example` vem com `VITE_ENABLE_MSW=true`: quem copia roda só com mock | Padrão `false`; mock só para QA isolado |
| I2 | ✅ | CI não roda typecheck/lint/build do web: `apps/web/package.json` não tem script `typecheck` | Adicionar `"typecheck": "tsc -b"` e passo `pnpm --filter utfpr-dacom-frontend lint build` no `ci.yml` |
| I3 | ✅ | README não explica como rodar o web | Seção "Frontend" com `.env`, `pnpm --filter utfpr-dacom-frontend dev` |
| I4 | ✅ | `apps/web/package-lock.json` (npm) versionado dentro do workspace pnpm | Remover |
| I5 | B | `VITE_API_BASE_URL` usado em `api-client.ts:4` e não documentado; reescrita manual do cookie em `vite.config.ts` é redundante | Documentar ou remover |
| I6 | B | `shadcn` (CLI) em `dependencies`; dois `cn` (pacote e `lib/utils.ts`) | Mover para dev; manter um `cn` só |
| I7 | ✅ | `CLAUDE.md` desatualizado (diz que faltam rotas da P1, que `apps/web` não existe, que a P2 está sem PR) | Atualizar |
| I8 | ✅ | `pnpm audit --prod --audit-level high` passou a falhar: `effect <= 3.22.0` (ReDoS, GHSA-7589-6fvf-x4pw) via `prisma` → `@prisma/config` | `pnpm.overrides` para `effect ^3.22.1`; remover quando o Prisma atualizar |

## Pessoa 1 — Backend financeiro

| # | P | Item | Onde | Correção |
| --- | --- | --- | --- | --- |
| F1 | A | Ano do orçamento calculado em UTC: solicitação de 31/12 após 21h (Brasília) vai para o orçamento do ano seguinte (ou 404) | `request-creation.service.ts:16`, `dashboard.controller.ts:7` | Ano em `America/Sao_Paulo` (mesmo fuso que o dashboard já usa para meses) |
| F2 | M | Votação aprovada provisiona mas não envia `notifyProvisioned`; em `AWAITING_BALANCE` o solicitante não fica sabendo | `requests.service.ts:95-97` | Notificar como nos outros 3 caminhos |
| F3 | M | Conselheiro convocado não consegue abrir o detalhe da solicitação (404) | `request-queries.service.ts:39` | Liberar para convocados de votação da solicitação |
| F4 | M | Limite de aprovação aceita `validFrom` no passado e reescreve vigência já usada | `approval-limit.service.ts:25-29` | Exigir `validFrom >= agora` |
| F5 | M | `changeStatus` grava só pelo `id` (hoje seguro pelos locks, mas não valida estado anterior no banco) | `requests.repository.ts:45` | `updateMany({ where: { id, status: from } })` + `ConflictError` |
| F6 | B | Ajuste de orçamento auditado sem `before` | `budget.service.ts:45-51` | Gravar saldo anterior |
| F7 | B | Leituras de relatório/dashboard com `Promise.all` fora de transação (snapshot inconsistente) | `budget.service.ts:142,155`, `dashboard.service.ts:21` | `$transaction([...])` RepeatableRead |
| F8 | B | Edição em `IN_VOTING`/`PROVISIONED` muda texto já votado | `request-edit.service.ts:15-16` | `[VALIDAR]` edição após aprovação |
| F9 | B | Rejeitadas entram no dashboard; pendentes grandes contam no limite acumulado | `dashboard.repository.ts:5`, `requests.service.ts:11-18` | `[VALIDAR]` |
| F10 | — | Testes faltando: cancelamento em `AWAITING_TIE_BREAK`, virada de ano/fuso, e-mail ao aprovar, conselheiro no detalhe, `validFrom` passado | `*/tests` | Um teste por item |

## Pessoa 2 — Backend de processos

| # | P | Item | Onde | Correção |
| --- | --- | --- | --- | --- |
| P1 | ✅ | Chefe pode desempatar votação da **própria** solicitação (a abertura já exclui o solicitante dos convocados) | `votings.service.ts:190-206` | 403 se `requesterId === actor.userId`; provisionar/pagar a própria: `[VALIDAR]` |
| P2 | A | Links dos e-mails: `/votacoes/:id` corrigido para `/deliberacoes/:id` ✅; falta a tela `/definir-senha` no front | `votings.service.ts:18`, `auth.service.ts:50` | Alinhar `/deliberacoes`; tela `/definir-senha` é da P3 (ver W5) |
| P3 | ✅ | `amount` das votações sai como `Decimal` cru (`"1500"` em vez de `"1500.00"`) | `votings.repository.ts:33,47` | Passar por `moneyOut` |
| P4 | B | OpenAPI documenta só códigos de resposta, sem schema de corpo | `docs/openapi.ts` | Incluir schemas de saída (ajuda o front a parar de divergir) |
| P5 | B | Aviso `pg`: "client.query() when the client is already executing a query" nos testes | a localizar | Investigar com `--trace-deprecation` |

## Pessoa 3 — Frontend base e solicitações

Todas confirmadas contra as rotas reais. Nenhuma aparece com MSW ligado.

| # | P | Item | Onde | Correção |
| --- | --- | --- | --- | --- |
| W1 | C | Painel docente e `/solicitacoes` esperam `{data, summary, totalPages}`; API devolve `{items, page, pageSize, total}` → lista vazia e card de erro sempre | `types/request.ts:82-93`, `requests-api.ts:10`, `overview.tsx`, `requests.tsx` | Usar tipos/client da P4 (`operational-request.ts`) |
| W2 | C | Criar/editar envia `{category: 'MATERIAL_CONSUMO', amount: 48000}`; API exige `{categoryId, amount: "480.00"}` → 400 sempre. Categorias fixas no código; `formatCurrency` em centavos | `request-modal.tsx`, `request.schema.ts`, `lib/utils.ts:13-18` | `GET /api/categories` (`useCategories` já existe), dinheiro como string |
| W3 | C | Cancelamento usa `PATCH`; API é `POST /api/requests/:id/cancel` → 404 | `requests-api.ts:35` | `POST` + `reason` |
| W4 | C | Gestão de usuários: as 5 chamadas divergem (`/users/invite`, `/profiles`, `/status`, formato `profiles[]` × `roleAssignments[]`, `endsAt: null`) | `users-api.ts`, `types/auth.ts:44-53`, `users.tsx` | Seguir `users.routes.ts` / `docs/guia-backend.md` |
| W5 | C | Recuperação de senha e convite: paths `/auth/forgot-password` e `/reset-password` não existem (`/auth/password/forgot` e `/reset`); sem tela `/definir-senha`; front aceita senha de 6 caracteres, API exige 8 | `services/api.ts:83,92`, `App.tsx`, `login.tsx:60` | Corrigir paths, criar a rota, mínimo 8 → hoje **nenhum convidado consegue entrar** |
| W6 | A | Avatar (`PATCH /api/auth/me/avatar`) não existe na API nem no modelo | `services/api.ts:79`, `profile-avatar-modal.tsx` | Remover ou `[VALIDAR]` |
| W7 | A | Rotas e menu por **perfil** (`PROFESSOR`), não por permissão: chefe/conselheiro também podem solicitar; "Voltar" do detalhe manda HEAD para `/acesso-negado` | `App.tsx:66,76`, `shell-layout.tsx`, `request-detail.tsx:81` | `allowedPermissions={['requests:create']}`; `navigate(-1)` |
| W8 | A | Regra de edição duplicada e divergente (front libera valor em `IN_VOTING`/`AWAITING_BALANCE`; API só em `AWAITING_VOTING`/`AWAITING_COMPLEMENT`) | `request-state-machine.ts:4-7` | Espelhar; ideal: API devolver `canEdit`/`canCancel` |
| W9 | M | Lista do docente sem link para o detalhe (não vê complementação pedida) | `requests.tsx` | Link para `/solicitacoes/:id` |
| W10 | M | Domínio `@utfpr.edu.br` exigido só no front | `login.tsx:36-38`, `user.schema.ts:56` | `[VALIDAR]` ou remover |
| W11 | B | Toast "Sessão expirada" para visitante que abre `/`; código CSRF morto (`XSRF-TOKEN` nunca emitido); `normalizeAuthUser` recalcula vigência que a API já resolve; status `DRAFT` inexistente | `services/api.ts`, `api-client.ts:49-62`, `auth-rules.ts` | Limpar |

## Pessoa 4 — Frontend operacional

Alinhada ao contrato na maior parte.

| # | P | Item | Onde | Correção |
| --- | --- | --- | --- | --- |
| O1 | M | Fila operacional sem `AWAITING_COMPLEMENT` (solicitação some após pedir complemento); `pageSize=100` fixo sem paginação | `operational-requests.tsx:14`, `operational-requests-api.ts:12` | Incluir status; paginar |
| O2 | M | Justificativa de cancelamento até 1000 caracteres no front, 500 na API | `operational-request.schema.ts:16` | 500 |
| O3 | M | Linha do tempo com rótulos que não batem com as ações reais (`REQUEST_CREATED`, `REQUEST_STATUS_CHANGED`, `PAYMENT_RECORDED`...) | `request-detail.tsx:44-55` | Ajustar `ACTION_LABELS` |
| O4 | B | Tipos de retorno errados: complementação e `ProvisionedRequest.status` | `operational-requests-api.ts:22` | Corrigir tipos |
| O5 | B | `moneyToApi` passa por `Number` (regra: nada de float em dinheiro) | `finance.schema.ts:5-14` | Normalizar a string |

## Pessoa 5 — Frontend analítico (PR #5)

| # | P | Item | Correção |
| --- | --- | --- | --- |
| N1 | A | "Análise Financeira" e "Relatórios" usam só dados de demonstração (`demo-data.ts`), com tipos próprios (status minúsculos, "purposes" fixos) e cálculo de saldo no front — viola "não duplicar regras" | Consumir `GET /api/dashboard?year=` e baixar `GET /api/reports/annual/:year.pdf` (PDF já é gerado no backend) |
| N2 | M | Rotas protegidas por perfil (`HEAD`, `FINANCIAL_ADMIN`) | `allowedPermissions={['dashboard:read']}` / `['reports:read']` |
| N3 | M | Histórico/auditoria (escopo da P5) ainda sem tela; API pronta em `GET /api/audit-logs` | Implementar |
| N4 | — | Testes Playwright (coordenação da P5) ainda não existem | Ao menos login → solicitação → votação → pagamento |

## Duplicações no frontend (P3 × P4)

Dois modelos de solicitação, dois `ExpenseCategory`, dois clients de `/api/requests` e de cancelamento, duas query keys na raiz `'requests'`, dois formatos de dinheiro (centavos × string), quatro cópias de `formatMoney`. Proposta: adotar os tipos e o client da P4 e apagar os da P3; mocks MSW seguindo `/api/docs/openapi.json` (hoje `GET /api/requests` responde em dois formatos e há dois bancos em memória).

## Ordem sugerida para "rodar liso"

1. I1 + I2 (mock desligado e CI checando o web) — barra a regressão.
2. W5 + P2 (convite/senha) — sem isso só o chefe do seed entra.
3. W1–W4 (telas da P3 contra a API real).
4. Merge do PR #5 e N1 (trocar demo por API).
5. P1, F1, F2, F3 e o resto por prioridade.
