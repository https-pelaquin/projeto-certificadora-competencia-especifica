import { z } from "zod";
import * as auditSchemas from "../modules/audit/audit.schemas";
import * as authSchemas from "../modules/auth/auth.schemas";
import * as usersSchemas from "../modules/users/users.schemas";
import * as votingsSchemas from "../modules/votings/votings.schemas";

// Contrato da API gerado dos mesmos schemas Zod usados na validação (fonte única).
type Operation = {
    method: "get" | "post" | "patch";
    path: string; // formato Express (:id)
    tag: string;
    summary: string;
    permission?: string;
    public?: boolean;
    body?: z.ZodType;
    query?: z.ZodObject;
    responses: Record<number, string>;
    pdf?: boolean;
};

const operations: Operation[] = [
    { method: "get", path: "/api/health", tag: "Sistema", summary: "Verifica API e banco", public: true, responses: { 200: "OK" } },

    { method: "post", path: "/api/auth/login", tag: "Autenticação", summary: "Entrar (cria cookie de sessão)", public: true, body: authSchemas.loginBody, responses: { 204: "Sessão criada", 401: "E-mail ou senha inválidos", 429: "Muitas tentativas" } },
    { method: "post", path: "/api/auth/logout", tag: "Autenticação", summary: "Sair", public: true, responses: { 204: "Sessão encerrada" } },
    { method: "get", path: "/api/auth/me", tag: "Autenticação", summary: "Usuário logado, perfis vigentes e permissões", responses: { 200: "Usuário", 401: "Sem sessão" } },
    { method: "post", path: "/api/auth/password/forgot", tag: "Autenticação", summary: "Pedir redefinição de senha (sempre 204)", public: true, body: authSchemas.forgotPasswordBody, responses: { 204: "Pedido registrado" } },
    { method: "post", path: "/api/auth/password/reset", tag: "Autenticação", summary: "Definir senha com token de convite ou redefinição", public: true, body: authSchemas.resetPasswordBody, responses: { 204: "Senha definida", 422: "Token inválido ou expirado" } },

    { method: "get", path: "/api/users", tag: "Usuários", summary: "Listar usuários", permission: "users:manage", responses: { 200: "Lista" } },
    { method: "post", path: "/api/users", tag: "Usuários", summary: "Convidar usuário", permission: "users:manage", body: usersSchemas.inviteBody, responses: { 201: "Usuário criado e convite enviado", 409: "E-mail já cadastrado" } },
    { method: "get", path: "/api/users/:id", tag: "Usuários", summary: "Detalhar usuário", permission: "users:manage", responses: { 200: "Usuário", 404: "Não encontrado" } },
    { method: "patch", path: "/api/users/:id", tag: "Usuários", summary: "Alterar nome ou ativar/desativar", permission: "users:manage", body: usersSchemas.updateBody, responses: { 200: "Usuário", 422: "Não pode desativar a si mesmo" } },
    { method: "post", path: "/api/users/:id/invite", tag: "Usuários", summary: "Reenviar convite", permission: "users:manage", responses: { 204: "Convite reenviado", 409: "Convite já aceito" } },
    { method: "post", path: "/api/users/:id/roles", tag: "Usuários", summary: "Atribuir perfil com vigência (chefe: 2 anos por padrão)", permission: "users:manage", body: usersSchemas.assignRoleBody, responses: { 201: "Usuário", 409: "Sobreposição de vigência", 422: "Datas inválidas" } },
    { method: "post", path: "/api/users/:id/roles/:assignmentId/end", tag: "Usuários", summary: "Encerrar atribuição de perfil", permission: "users:manage", body: usersSchemas.endRoleBody, responses: { 200: "Usuário", 409: "Já encerrada" } },

    { method: "post", path: "/api/requests/:requestId/votings", tag: "Votações", summary: "Abrir votação", permission: "votings:open", body: votingsSchemas.openBody, responses: { 201: "Votação aberta", 409: "Solicitação não aguarda votação", 422: "Prazo inválido ou sem conselheiros" } },
    { method: "get", path: "/api/votings", tag: "Votações", summary: "Listar votações visíveis ao usuário", query: votingsSchemas.listQuery, responses: { 200: "Lista" } },
    { method: "get", path: "/api/votings/:id", tag: "Votações", summary: "Detalhar votação (votos só para convocados e chefe)", responses: { 200: "Votação", 403: "Sem vínculo" } },
    { method: "post", path: "/api/votings/:id/votes", tag: "Votações", summary: "Votar", permission: "votings:vote", body: votingsSchemas.voteBody, responses: { 201: "Voto registrado", 403: "Não convocado", 409: "Já votou ou votação fechada", 422: "Prazo encerrado" } },
    { method: "post", path: "/api/votings/:id/tie-break", tag: "Votações", summary: "Voto de desempate do chefe", permission: "votings:tieBreak", body: votingsSchemas.tieBreakBody, responses: { 200: "Votação encerrada", 409: "Não aguarda desempate" } },
    { method: "get", path: "/api/votings/:id/comments", tag: "Votações", summary: "Comentários do conselho", permission: "votings:comment", responses: { 200: "Lista", 403: "Sem acesso" } },
    { method: "post", path: "/api/votings/:id/comments", tag: "Votações", summary: "Comentar", permission: "votings:comment", body: votingsSchemas.commentBody, responses: { 201: "Comentário criado", 409: "Votação encerrada" } },

    { method: "get", path: "/api/audit-logs", tag: "Auditoria", summary: "Consultar auditoria", permission: "audit:read", query: auditSchemas.listQuery, responses: { 200: "Página de registros" } },

    { method: "get", path: "/api/reports/annual/:year.pdf", tag: "Relatórios", summary: "Relatório anual em PDF", permission: "reports:read", pdf: true, responses: { 200: "PDF", 404: "Ano sem orçamento" } },
];

const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

const errorSchema = {
    type: "object",
    properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } },
};

function toOperation(op: Operation) {
    const pathParams = [...op.path.matchAll(/:(\w+)/g)].map(([, name]) => ({
        name, in: "path", required: true, schema: { type: "integer" },
    }));
    const queryParams = op.query
        ? Object.entries(op.query.shape).map(([name, schema]) => ({
            name, in: "query", required: !(schema as z.ZodType).safeParse(undefined).success, schema: jsonSchema(schema as z.ZodType),
        }))
        : [];

    const responses: Record<string, unknown> = {};
    for (const [status, description] of Object.entries(op.responses)) {
        responses[status] = Number(status) >= 400
            ? { description, content: { "application/json": { schema: errorSchema } } }
            : { description, ...(op.pdf && status === "200" && { content: { "application/pdf": { schema: { type: "string", format: "binary" } } } }) };
    }
    if (op.body) responses["400"] = { description: "Dados inválidos", content: { "application/json": { schema: errorSchema } } };
    if (!op.public) responses["401"] = { description: "Sem sessão" };
    if (op.permission) responses["403"] ??= { description: `Exige a permissão ${op.permission}` };

    return {
        tags: [op.tag],
        summary: op.summary,
        description: op.permission ? `Permissão: \`${op.permission}\`` : undefined,
        security: op.public ? [] : [{ session: [] }],
        parameters: [...pathParams, ...queryParams],
        ...(op.body && { requestBody: { required: true, content: { "application/json": { schema: jsonSchema(op.body) } } } }),
        responses,
    };
}

export function buildOpenApiDocument() {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const op of operations) {
        const path = op.path.replace(/:(\w+)/g, "{$1}");
        (paths[path] ??= {})[op.method] = toOperation(op);
    }

    return {
        openapi: "3.1.0",
        info: {
            title: "API — Gestão de recursos do DACOM",
            version: "0.1.0",
            description: "Erros seguem `{ error: { code, message } }`. Requisições com corpo devem usar `application/json`. Autenticação por cookie de sessão (`POST /api/auth/login`).",
        },
        components: { securitySchemes: { session: { type: "apiKey", in: "cookie", name: "dacom.sid" } } },
        paths,
    };
}
