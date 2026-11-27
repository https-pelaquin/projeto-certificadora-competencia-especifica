import { http, HttpResponse, delay } from 'msw';
import {
  canModifyRequest,
  isAmountLocked,
} from '@/features/requests/utils/request-state-machine';
import {
  computeFinancialSummary,
  findActiveHeadUser,
  getSessionUserId,
  mockDb,
  numericUserId,
  operationalDb,
  permissionsForUser,
  saveUserAvatar,
  setSessionUserId,
  stringUserId,
  toAuthUser,
} from './db';
import type {
  AssignProfilePayload,
  CreateRequestPayload,
  InviteUserPayload,
  LoginPayload,
  Permission,
  ProfileTenure,
  Request,
  UpdateAvatarPayload,
  UpdateRequestPayload,
  User,
} from '@/types';
import type {
  CreateApprovalLimitPayload,
  CreateBudgetAdjustmentPayload,
  CreateBudgetPayload,
  CreateCategoryPayload,
  LedgerEntry,
  PaymentPayload,
  UpdateCategoryPayload,
} from '@/types/finance';
import type {
  CancelOperationalRequestPayload,
  OperationalPerson,
  OperationalRequest,
  RequestComplementPayload,
} from '@/types/operational-request';
import type {
  CommentPayload,
  OpenVotingPayload,
  TieBreakPayload,
  VoteChoice,
  VotePayload,
  VotingDetail,
  VotingListItem,
  VotingRecord,
  VotingStatus,
} from '@/types/voting';

const VALID_CATEGORIES = new Set([
  'MATERIAL_CONSUMO',
  'SERVICOS_TERCEIROS',
  'EQUIPAMENTOS',
  'DIARIAS_PASSAGENS',
  'OUTROS',
]);

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

function sessionActor(): {
  user: User;
  id: number;
  permissions: Permission[];
} | null {
  const sessionId = getSessionUserId();
  if (!sessionId) return null;
  const user = mockDb.users.find((candidate) => candidate.id === sessionId);
  const id = numericUserId(sessionId);
  if (!user?.active || id === null) return null;
  return { user, id, permissions: permissionsForUser(user) };
}

function person(id: number): OperationalPerson {
  const user = mockDb.users.find((candidate) => candidate.id === stringUserId(id));
  return { id, name: user?.name ?? `Usuário ${id}` };
}

function hasPermission(
  actor: ReturnType<typeof sessionActor>,
  permission: Permission,
): boolean {
  return Boolean(actor?.permissions.includes(permission));
}

function money(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function moneyOut(value: number): string {
  return value.toFixed(2);
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
}

function recalculateBudget(budgetId: number): void {
  const budget = operationalDb.budgets.find((item) => item.id === budgetId);
  if (!budget) return;
  const entries = operationalDb.ledger[budgetId] ?? [];
  const sum = (type: LedgerEntry['type']) =>
    entries
      .filter((entry) => entry.type === type)
      .reduce((total, entry) => total + Number(entry.amount), 0);
  const total =
    Number(budget.initialAmount) + sum('ADJUSTMENT_IN') - sum('ADJUSTMENT_OUT');
  budget.balance = {
    total: moneyOut(total),
    available: moneyOut(total - sum('PROVISION') + sum('RELEASE')),
    provisioned: moneyOut(
      sum('PROVISION') - sum('RELEASE') - sum('SPEND'),
    ),
    spent: moneyOut(sum('SPEND')),
  };
}

function addLedgerEntry(
  budgetId: number,
  actorId: number,
  entry: Omit<LedgerEntry, 'id' | 'createdBy' | 'createdAt'>,
  at = new Date().toISOString(),
): LedgerEntry {
  const entries = (operationalDb.ledger[budgetId] ??= []);
  const created: LedgerEntry = {
    ...entry,
    id: Math.max(
      0,
      ...Object.values(operationalDb.ledger)
        .flat()
        .map((item) => item.id),
    ) + 1,
    createdBy: person(actorId),
    createdAt: at,
  };
  entries.unshift(created);
  recalculateBudget(budgetId);
  return created;
}

function addTimeline(
  target: OperationalRequest,
  actorId: number,
  action: string,
  fromStatus: OperationalRequest['status'] | null,
  toStatus: OperationalRequest['status'] | null,
  justification: string | null = null,
  at = new Date().toISOString(),
): void {
  target.updatedAt = at;
  target.timeline.push({
    at,
    action,
    actor: person(actorId),
    fromStatus,
    toStatus,
    justification,
  });
}

function votingRecord(voting: (typeof operationalDb.votings)[number]): VotingRecord {
  return {
    id: voting.id,
    requestId: voting.requestId,
    openedById: voting.openedById,
    openedAt: voting.openedAt,
    deadline: voting.deadline,
    status: voting.status,
    result: voting.result,
    approveCount: voting.approveCount,
    rejectCount: voting.rejectCount,
    abstainCount: voting.abstainCount,
    closedAt: voting.closedAt,
  };
}

function votingSummary(
  voting: (typeof operationalDb.votings)[number],
  actorId: number,
): VotingListItem | null {
  const target = operationalDb.requests.find(
    (request) => request.id === voting.requestId,
  );
  if (!target) return null;
  const vote = voting.votes.find((item) => item.userId === actorId);
  return {
    id: voting.id,
    request: {
      id: target.id,
      requesterId: target.requester.id,
      description: target.description,
      amount: target.amount,
      status: target.status,
    },
    status: voting.status,
    result: voting.result,
    openedAt: voting.openedAt,
    deadline: voting.deadline,
    closedAt: voting.closedAt,
    convened: voting.memberIds.includes(actorId),
    myVote: vote?.choice ?? null,
  };
}

function canSeeVoting(
  voting: (typeof operationalDb.votings)[number],
  actor: NonNullable<ReturnType<typeof sessionActor>>,
): boolean {
  const target = operationalDb.requests.find(
    (request) => request.id === voting.requestId,
  );
  return Boolean(
    target &&
      (target.requester.id === actor.id ||
        voting.memberIds.includes(actor.id) ||
        actor.user.profiles.some((profile) => profile.role === 'HEAD') ||
        actor.permissions.includes('requests:readAll')),
  );
}

function canAccessOperationalRequest(
  target: OperationalRequest,
  actor: NonNullable<ReturnType<typeof sessionActor>>,
): boolean {
  return (
    target.requester.id === actor.id ||
    actor.permissions.includes('requests:readAll')
  );
}

async function handleOperationalCancel(
  id: number,
  payload: Partial<CancelOperationalRequestPayload> = {},
) {
  const actor = sessionActor();
  if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
  const target = operationalDb.requests.find((request) => request.id === id);
  if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
  const isOwner = target.requester.id === actor.id;
  if (!isOwner && !hasPermission(actor, 'requests:cancelAny')) {
    return errorResponse(403, 'FORBIDDEN', 'Só o solicitante ou o chefe podem cancelar esta solicitação');
  }
  const justification = payload.justification?.trim() || null;
  if (!isOwner && !justification) {
    return errorResponse(422, 'BUSINESS_RULE', 'Informe a justificativa do cancelamento');
  }
  if (['PAID', 'REJECTED', 'CANCELED'].includes(target.status)) {
    return errorResponse(409, 'CONFLICT', 'Esta solicitação não pode mais ser cancelada');
  }

  const now = new Date().toISOString();
  const previous = target.status;
  if (previous === 'PROVISIONED' && target.budget) {
    const provisioned = Number(target.amounts.provisioned ?? '0');
    if (provisioned > 0) {
      addLedgerEntry(target.budget.id, actor.id, {
        type: 'RELEASE',
        amount: moneyOut(provisioned),
        requestId: target.id,
        justification,
      }, now);
      target.amounts.provisioned = '0.00';
    }
  }
  const activeVoting = operationalDb.votings.find(
    (voting) =>
      voting.requestId === target.id &&
      (voting.status === 'OPEN' || voting.status === 'AWAITING_TIE_BREAK'),
  );
  if (activeVoting) {
    activeVoting.status = 'CANCELED';
    activeVoting.closedAt = now;
  }
  target.status = 'CANCELED';
  addTimeline(target, actor.id, 'REQUEST_STATUS_CHANGED', previous, 'CANCELED', justification, now);
  return HttpResponse.json(target);
}

async function handleCancelRequest(id: string) {
  await delay(500);
  const idx = mockDb.requests.findIndex((r) => r.id === id);
  if (idx === -1) {
    return errorResponse(404, 'REQUEST_NOT_FOUND', 'Solicitação não encontrada.');
  }

  const existing = mockDb.requests[idx];
  if (!canModifyRequest(existing.status)) {
    return errorResponse(
      409,
      'REQUEST_IMMUTABLE',
      'Solicitações pagas, rejeitadas ou já canceladas não podem ser canceladas.',
    );
  }

  const canceled: Request = {
    ...existing,
    status: 'CANCELED',
    updatedAt: new Date().toISOString(),
  };
  mockDb.requests[idx] = canceled;

  return HttpResponse.json(canceled, { status: 200 });
}

export const handlers = [
  // ============================================================
  // Autenticação e Sessão (/api/auth/*)
  // ============================================================
  http.get('/api/auth/me', async () => {
    await delay(200);
    const sessionUserId = getSessionUserId();
    if (!sessionUserId) {
      return errorResponse(
        401,
        'SESSION_EXPIRED',
        'Sessão não autenticada ou expirada.',
      );
    }

    const user = mockDb.users.find((u) => u.id === sessionUserId);
    if (!user) {
      return errorResponse(401, 'USER_NOT_FOUND', 'Sessão inválida.');
    }

    if (!user.active) {
      setSessionUserId(null);
      return errorResponse(
        403,
        'USER_INACTIVE',
        'Seu usuário foi desativado no sistema.',
      );
    }

    const authUser = toAuthUser(user);
    return HttpResponse.json(
      {
        id: numericUserId(user.id) ?? user.id,
        name: authUser.name,
        email: authUser.email,
        roles: authUser.activeRoles,
        permissions: authUser.permissions,
      },
      { status: 200 },
    );
  }),

  http.post('/api/auth/login', async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as Partial<LoginPayload>;
    const normalizedEmail = body.email?.trim().toLowerCase() ?? '';

    if (!normalizedEmail || !body.password || body.password.length < 6) {
      return errorResponse(400, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
    }

    const user = mockDb.users.find(
      (u) => u.email.toLowerCase() === normalizedEmail,
    );

    if (!user) {
      return errorResponse(
        401,
        'INVALID_CREDENTIALS',
        'Usuário institucional não encontrado no sistema do DACOM.',
      );
    }

    if (!user.active) {
      return errorResponse(
        403,
        'USER_INACTIVE',
        'Usuário desativado. Contate a chefia do DACOM.',
      );
    }

    setSessionUserId(user.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/auth/logout', async () => {
    await delay(150);
    setSessionUserId(null);
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('/api/auth/me/avatar', async ({ request }) => {
    await delay(300);
    const sessionUserId = getSessionUserId();
    if (!sessionUserId) {
      return errorResponse(
        401,
        'SESSION_EXPIRED',
        'Sessão não autenticada ou expirada.',
      );
    }

    const userIdx = mockDb.users.findIndex((u) => u.id === sessionUserId);
    if (userIdx === -1) {
      return errorResponse(401, 'USER_NOT_FOUND', 'Sessão inválida.');
    }

    const existing = mockDb.users[userIdx];
    if (!existing.active) {
      return errorResponse(
        403,
        'USER_INACTIVE',
        'Usuário desativado no sistema.',
      );
    }

    const body = (await request.json()) as Partial<UpdateAvatarPayload>;
    const avatarUrl = body.avatarUrl ?? null;

    if (
      avatarUrl !== null &&
      (typeof avatarUrl !== 'string' ||
        !/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,)/.test(
          avatarUrl,
        ))
    ) {
      return errorResponse(
        400,
        'INVALID_AVATAR',
        'Formato de imagem inválido. Utilize PNG, JPG ou WEBP.',
      );
    }

    const updatedUser: User = {
      ...existing,
      avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    mockDb.users[userIdx] = updatedUser;
    saveUserAvatar(updatedUser.id, avatarUrl);

    return HttpResponse.json({ user: toAuthUser(updatedUser) }, { status: 200 });
  }),

  http.post('/api/auth/forgot-password', async ({ request }) => {
    await delay(350);
    await request.json();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/auth/reset-password', async () => {
    await delay(350);
    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================
  // Solicitações Financeiras (/api/requests)
  // ============================================================
  http.get('/api/requests', async ({ request }) => {
    await delay(400);
    const query = new URL(request.url).searchParams;
    const status = query.get('status');
    if (status) {
      const actor = sessionActor();
      if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
      const visible = operationalDb.requests.filter((item) =>
        item.status === status && canAccessOperationalRequest(item, actor),
      );
      const page = Math.max(1, Number(query.get('page')) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 50));
      return HttpResponse.json({
        items: visible.slice((page - 1) * pageSize, page * pageSize).map((item) => ({
          id: item.id,
          status: item.status,
          description: item.description,
          amount: item.amount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          requester: item.requester,
          category: item.category,
        })),
        page,
        pageSize,
        total: visible.length,
      });
    }
    const data = [...mockDb.requests];
    const summary = computeFinancialSummary(data);

    return HttpResponse.json(
      {
        data,
        summary,
        total: data.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      { status: 200 },
    );
  }),

  http.post('/api/requests', async ({ request }) => {
    await delay(450);
    const body = (await request.json()) as Partial<CreateRequestPayload>;

    if (!body.category || !VALID_CATEGORIES.has(body.category)) {
      return errorResponse(
        400,
        'INVALID_CATEGORY',
        'Categoria de despesa inválida.',
      );
    }

    if (
      typeof body.amount !== 'number' ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      return errorResponse(
        400,
        'INVALID_AMOUNT',
        'O valor da solicitação deve ser maior que zero.',
      );
    }

    if (!body.description || body.description.trim().length < 10) {
      return errorResponse(
        400,
        'INVALID_DESCRIPTION',
        'A justificativa deve conter ao menos 10 caracteres.',
      );
    }

    const now = new Date().toISOString();
    const sessionUserId = getSessionUserId() ?? 'usr-1';
    const created: Request = {
      id: `req-${Date.now().toString().slice(-4)}`,
      userId: sessionUserId,
      category: body.category,
      description: body.description.trim(),
      amount: Math.round(body.amount),
      status: 'AWAITING_VOTING',
      attachmentName: body.attachmentName || 'anexo_justificativa.pdf',
      attachmentUrl: '#',
      createdAt: now,
      updatedAt: now,
    };

    mockDb.requests = [created, ...mockDb.requests];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('/api/requests/:id', async ({ params, request }) => {
    await delay(450);
    const id = String(params.id);
    const idx = mockDb.requests.findIndex((r) => r.id === id);

    if (idx === -1) {
      return errorResponse(404, 'REQUEST_NOT_FOUND', 'Solicitação não encontrada.');
    }

    const existing = mockDb.requests[idx];
    if (!canModifyRequest(existing.status)) {
      return errorResponse(
        409,
        'REQUEST_IMMUTABLE',
        'Solicitação bloqueada para edição no status atual.',
      );
    }

    const body = (await request.json()) as Partial<UpdateRequestPayload>;
    if (!body.description || body.description.trim().length < 10) {
      return errorResponse(
        400,
        'INVALID_DESCRIPTION',
        'A justificativa deve conter ao menos 10 caracteres.',
      );
    }

    const locked = isAmountLocked(existing.status);
    let nextAmount = existing.amount;

    if (!locked && body.amount !== undefined) {
      if (
        typeof body.amount !== 'number' ||
        !Number.isFinite(body.amount) ||
        body.amount <= 0
      ) {
        return errorResponse(
          400,
          'INVALID_AMOUNT',
          'O valor da solicitação deve ser maior que zero.',
        );
      }
      nextAmount = Math.round(body.amount);
    }

    const updated: Request = {
      ...existing,
      description: body.description.trim(),
      amount: nextAmount,
      ...(body.attachmentName ? { attachmentName: body.attachmentName } : {}),
      updatedAt: new Date().toISOString(),
    };

    mockDb.requests[idx] = updated;
    return HttpResponse.json(updated, { status: 200 });
  }),

  http.patch('/api/requests/:id/cancel', ({ params }) => {
    const id = String(params.id);
    return /^\d+$/.test(id)
      ? handleOperationalCancel(Number(id))
      : handleCancelRequest(id);
  }),

  http.post('/api/requests/:id/cancel', async ({ params, request }) => {
    const id = String(params.id);
    if (!/^\d+$/.test(id)) return handleCancelRequest(id);
    const body = (await request.json()) as Partial<CancelOperationalRequestPayload>;
    return handleOperationalCancel(Number(id), body);
  }),

  // ============================================================
  // Solicitações operacionais, votações e finanças (IDs numéricos)
  // ============================================================
  http.get('/api/requests/:id', async ({ params }) => {
    await delay(200);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    const id = Number(params.id);
    const target = operationalDb.requests.find((item) => item.id === id);
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (!canAccessOperationalRequest(target, actor)) {
      return errorResponse(403, 'FORBIDDEN', 'Você não tem acesso a esta solicitação');
    }
    return HttpResponse.json(target);
  }),

  http.post('/api/requests/:id/complement-requests', async ({ params, request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'requests:requestComplement')) {
      return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    }
    const target = operationalDb.requests.find((item) => item.id === Number(params.id));
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (target.status !== 'AWAITING_VOTING' && target.status !== 'IN_VOTING') {
      return errorResponse(409, 'CONFLICT', 'A complementação só pode ser pedida antes ou durante a votação');
    }
    const body = (await request.json()) as Partial<RequestComplementPayload>;
    const message = body.message?.trim() ?? '';
    if (!message || message.length > 2000) {
      return errorResponse(422, 'BUSINESS_RULE', message ? 'A mensagem pode ter no máximo 2.000 caracteres' : 'Informe o que precisa ser complementado');
    }
    const now = new Date().toISOString();
    const complement = {
      id: nextId(target.complementRequests),
      message,
      requestedBy: person(actor.id),
      createdAt: now,
    };
    target.complementRequests.push(complement);
    addTimeline(target, actor.id, 'COMPLEMENT_REQUESTED', null, null, message, now);
    if (target.status === 'AWAITING_VOTING') {
      target.status = 'AWAITING_COMPLEMENT';
      addTimeline(target, actor.id, 'REQUEST_STATUS_CHANGED', 'AWAITING_VOTING', 'AWAITING_COMPLEMENT', null, now);
    }
    return HttpResponse.json({ id: complement.id, message: complement.message, createdAt: complement.createdAt, requestStatus: target.status }, { status: 201 });
  }),

  http.get('/api/votings', async ({ request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    const status = new URL(request.url).searchParams.get('status') as VotingStatus | null;
    const validStatuses: VotingStatus[] = ['OPEN', 'AWAITING_TIE_BREAK', 'CLOSED', 'CANCELED'];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Status de votação inválido');
    }
    const items = operationalDb.votings
      .filter((voting) => (!status || voting.status === status) && canSeeVoting(voting, actor))
      .map((voting) => votingSummary(voting, actor.id))
      .filter((item): item is VotingListItem => item !== null);
    return HttpResponse.json(items);
  }),

  http.get('/api/votings/:id', async ({ params }) => {
    await delay(200);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    const voting = operationalDb.votings.find((item) => item.id === Number(params.id));
    if (!voting) return errorResponse(404, 'NOT_FOUND', 'Votação não encontrada');
    if (!canSeeVoting(voting, actor)) {
      return errorResponse(403, 'FORBIDDEN', 'Você não tem acesso a esta votação');
    }
    const summary = votingSummary(voting, actor.id);
    if (!summary) return errorResponse(404, 'NOT_FOUND', 'Solicitação da votação não encontrada');
    const target = operationalDb.requests.find((item) => item.id === voting.requestId)!;
    const privileged =
      target.requester.id !== actor.id &&
      (voting.memberIds.includes(actor.id) || actor.user.profiles.some((profile) => profile.role === 'HEAD'));
    const detail: VotingDetail = {
      id: summary.id,
      request: summary.request,
      status: summary.status,
      result: summary.result,
      openedAt: summary.openedAt,
      deadline: summary.deadline,
      closedAt: summary.closedAt,
      ...(privileged
        ? {
            counts: voting.approveCount === null ? null : {
              approve: voting.approveCount,
              reject: voting.rejectCount ?? 0,
              abstain: voting.abstainCount ?? 0,
            },
            members: voting.memberIds.map((memberId) => {
              const vote = voting.votes.find((item) => item.userId === memberId);
              return { id: memberId, name: person(memberId).name, vote: vote?.choice ?? null, votedAt: vote?.createdAt ?? null };
            }),
            tieBreak: voting.tieBreak,
            canVote: voting.status === 'OPEN' && voting.memberIds.includes(actor.id) && !voting.votes.some((vote) => vote.userId === actor.id),
          }
        : {}),
    };
    return HttpResponse.json(detail);
  }),

  http.post('/api/requests/:requestId/votings', async ({ params, request }) => {
    await delay(300);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'votings:open')) {
      return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    }
    const target = operationalDb.requests.find((item) => item.id === Number(params.requestId));
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (target.status !== 'AWAITING_VOTING') {
      return errorResponse(409, 'CONFLICT', 'A solicitação não está aguardando votação');
    }
    const body = (await request.json()) as Partial<OpenVotingPayload>;
    const deadline = body.deadline ? new Date(body.deadline) : null;
    if (!deadline || Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      return errorResponse(422, 'BUSINESS_RULE', 'O prazo da votação deve ser no futuro');
    }
    const memberIds = mockDb.users
      .filter((user) => user.active && user.id !== stringUserId(target.requester.id))
      .filter((user) => user.profiles.some((profile) => profile.role === 'COUNCIL_MEMBER'))
      .filter((user) => !user.profiles.some((profile) => profile.role === 'HEAD'))
      .map((user) => numericUserId(user.id))
      .filter((id): id is number => id !== null);
    if (memberIds.length === 0) {
      return errorResponse(422, 'BUSINESS_RULE', 'Não há conselheiros aptos a votar esta solicitação');
    }
    const now = new Date().toISOString();
    const created = {
      id: nextId(operationalDb.votings),
      requestId: target.id,
      openedById: actor.id,
      openedAt: now,
      deadline: deadline.toISOString(),
      status: 'OPEN' as const,
      result: null,
      approveCount: null,
      rejectCount: null,
      abstainCount: null,
      closedAt: null,
      memberIds,
      votes: [],
      comments: [],
      tieBreak: null,
    };
    operationalDb.votings.push(created);
    target.status = 'IN_VOTING';
    addTimeline(target, actor.id, 'VOTING_OPENED', 'AWAITING_VOTING', 'IN_VOTING', null, now);
    return HttpResponse.json(votingRecord(created), { status: 201 });
  }),

  http.post('/api/votings/:id/votes', async ({ params, request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'votings:vote')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const voting = operationalDb.votings.find((item) => item.id === Number(params.id));
    if (!voting) return errorResponse(404, 'NOT_FOUND', 'Votação não encontrada');
    if (!voting.memberIds.includes(actor.id)) return errorResponse(403, 'FORBIDDEN', 'Você não foi convocado para esta votação');
    if (voting.status !== 'OPEN') return errorResponse(409, 'CONFLICT', 'A votação não está aberta');
    if (new Date() >= new Date(voting.deadline)) return errorResponse(422, 'BUSINESS_RULE', 'O prazo da votação terminou');
    if (voting.votes.some((vote) => vote.userId === actor.id)) return errorResponse(409, 'CONFLICT', 'Você já votou nesta votação');
    const body = (await request.json()) as Partial<VotePayload>;
    const choices: VoteChoice[] = ['APPROVE', 'REJECT', 'ABSTAIN'];
    if (!body.choice || !choices.includes(body.choice)) return errorResponse(400, 'VALIDATION_ERROR', 'Voto inválido');
    const vote = { votingId: voting.id, userId: actor.id, choice: body.choice, createdAt: new Date().toISOString() };
    voting.votes.push(vote);
    return HttpResponse.json(vote, { status: 201 });
  }),

  http.post('/api/votings/:id/tie-break', async ({ params, request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'votings:tieBreak')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const voting = operationalDb.votings.find((item) => item.id === Number(params.id));
    if (!voting) return errorResponse(404, 'NOT_FOUND', 'Votação não encontrada');
    if (voting.status !== 'AWAITING_TIE_BREAK') return errorResponse(409, 'CONFLICT', 'A votação não aguarda desempate');
    const body = (await request.json()) as Partial<TieBreakPayload>;
    if (body.choice !== 'APPROVE' && body.choice !== 'REJECT') return errorResponse(400, 'VALIDATION_ERROR', 'Escolha de desempate inválida');
    const now = new Date().toISOString();
    voting.tieBreak = { head: person(actor.id), choice: body.choice, createdAt: now };
    voting.status = 'CLOSED';
    voting.result = body.choice === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    voting.closedAt = now;
    const target = operationalDb.requests.find((item) => item.id === voting.requestId);
    if (target) {
      const previous = target.status;
      target.status = voting.result === 'APPROVED' ? 'AWAITING_BALANCE' : 'REJECTED';
      addTimeline(target, actor.id, 'REQUEST_STATUS_CHANGED', previous, target.status, null, now);
    }
    return HttpResponse.json(votingRecord(voting));
  }),

  http.get('/api/votings/:id/comments', async ({ params }) => {
    await delay(150);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'votings:comment')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const voting = operationalDb.votings.find((item) => item.id === Number(params.id));
    if (!voting) return errorResponse(404, 'NOT_FOUND', 'Votação não encontrada');
    const target = operationalDb.requests.find((item) => item.id === voting.requestId);
    const allowed = target?.requester.id !== actor.id && (voting.memberIds.includes(actor.id) || actor.user.profiles.some((profile) => profile.role === 'HEAD'));
    if (!allowed) return errorResponse(403, 'FORBIDDEN', 'Comentários restritos aos conselheiros convocados e ao chefe');
    return HttpResponse.json(voting.comments);
  }),

  http.post('/api/votings/:id/comments', async ({ params, request }) => {
    await delay(200);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'votings:comment')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const voting = operationalDb.votings.find((item) => item.id === Number(params.id));
    if (!voting) return errorResponse(404, 'NOT_FOUND', 'Votação não encontrada');
    const target = operationalDb.requests.find((item) => item.id === voting.requestId);
    const allowed = target?.requester.id !== actor.id && (voting.memberIds.includes(actor.id) || actor.user.profiles.some((profile) => profile.role === 'HEAD'));
    if (!allowed) return errorResponse(403, 'FORBIDDEN', 'Comentários restritos aos conselheiros convocados e ao chefe');
    if (voting.status !== 'OPEN' && voting.status !== 'AWAITING_TIE_BREAK') return errorResponse(409, 'CONFLICT', 'A votação está encerrada para comentários');
    const body = (await request.json()) as Partial<CommentPayload>;
    const text = body.body?.trim() ?? '';
    if (!text) return errorResponse(400, 'VALIDATION_ERROR', 'Informe o comentário');
    const comment = { id: nextId(operationalDb.votings.flatMap((item) => item.comments)), votingId: voting.id, authorId: actor.id, body: text, createdAt: new Date().toISOString(), author: person(actor.id) };
    voting.comments.push(comment);
    return HttpResponse.json(comment, { status: 201 });
  }),

  http.get('/api/budgets', async () => {
    await delay(200);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:read')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    return HttpResponse.json(operationalDb.budgets);
  }),

  http.get('/api/budgets/:id', async ({ params }) => {
    await delay(150);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:read')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const budget = operationalDb.budgets.find((item) => item.id === Number(params.id));
    return budget
      ? HttpResponse.json(budget)
      : errorResponse(404, 'NOT_FOUND', 'Orçamento não encontrado');
  }),

  http.post('/api/budgets', async ({ request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const body = (await request.json()) as Partial<CreateBudgetPayload>;
    const amount = typeof body.initialAmount === 'string' ? money(body.initialAmount) : null;
    if (!Number.isInteger(body.year) || !amount) return errorResponse(400, 'VALIDATION_ERROR', 'Ano e valor inicial válidos são obrigatórios');
    if (operationalDb.budgets.some((item) => item.year === body.year)) return errorResponse(409, 'CONFLICT', `Já existe orçamento para o ano ${body.year}`);
    const created = {
      id: nextId(operationalDb.budgets),
      year: body.year!,
      initialAmount: moneyOut(amount),
      createdAt: new Date().toISOString(),
      balance: { total: moneyOut(amount), available: moneyOut(amount), provisioned: '0.00', spent: '0.00' },
    };
    operationalDb.budgets.push(created);
    operationalDb.ledger[created.id] = [];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post('/api/budgets/:id/adjustments', async ({ params, request }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const budget = operationalDb.budgets.find((item) => item.id === Number(params.id));
    if (!budget) return errorResponse(404, 'NOT_FOUND', 'Orçamento não encontrado');
    const body = (await request.json()) as Partial<CreateBudgetAdjustmentPayload>;
    const amount = typeof body.amount === 'string' ? money(body.amount) : null;
    if (!amount || (body.type !== 'ADJUSTMENT_IN' && body.type !== 'ADJUSTMENT_OUT') || !body.justification?.trim()) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Tipo, valor e justificativa são obrigatórios');
    }
    if (body.type === 'ADJUSTMENT_OUT' && amount > Number(budget.balance.available)) {
      return errorResponse(422, 'BUSINESS_RULE', 'O saldo disponível não pode ficar negativo');
    }
    addLedgerEntry(budget.id, actor.id, { type: body.type, amount: moneyOut(amount), requestId: null, justification: body.justification.trim() });
    return HttpResponse.json({ balance: budget.balance }, { status: 201 });
  }),

  http.get('/api/budgets/:id/ledger', async ({ params, request }) => {
    await delay(180);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:read')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const budgetId = Number(params.id);
    if (!operationalDb.budgets.some((item) => item.id === budgetId)) return errorResponse(404, 'NOT_FOUND', 'Orçamento não encontrado');
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Number(query.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 20));
    const entries = operationalDb.ledger[budgetId] ?? [];
    return HttpResponse.json({
      items: entries.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: entries.length,
    });
  }),

  http.get('/api/approval-limits', async () => {
    await delay(150);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:read')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    return HttpResponse.json(operationalDb.approvalLimits);
  }),

  http.post('/api/approval-limits', async ({ request }) => {
    await delay(200);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'limits:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const body = (await request.json()) as Partial<CreateApprovalLimitPayload>;
    const amount = typeof body.amount === 'string' ? money(body.amount) : null;
    if (!amount || !Number.isInteger(body.periodMonths) || (body.periodMonths ?? 0) < 1) return errorResponse(422, 'BUSINESS_RULE', 'Valor e período do limite devem ser maiores que zero');
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    if (Number.isNaN(validFrom.getTime())) return errorResponse(400, 'VALIDATION_ERROR', 'Data inicial inválida');
    const latest = operationalDb.approvalLimits.at(-1);
    if (latest && validFrom <= new Date(latest.validFrom)) return errorResponse(422, 'BUSINESS_RULE', 'O novo limite deve começar depois do início do último limite cadastrado');
    if (latest) latest.validUntil = validFrom.toISOString();
    const created = { id: nextId(operationalDb.approvalLimits), amount: moneyOut(amount), periodMonths: body.periodMonths!, validFrom: validFrom.toISOString(), validUntil: null };
    operationalDb.approvalLimits.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get('/api/categories', async () => {
    await delay(120);
    if (!sessionActor()) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    return HttpResponse.json(operationalDb.categories);
  }),

  http.post('/api/categories', async ({ request }) => {
    await delay(180);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'categories:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const body = (await request.json()) as Partial<CreateCategoryPayload>;
    const name = body.name?.trim() ?? '';
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'Informe o nome da categoria');
    if (operationalDb.categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) return errorResponse(409, 'CONFLICT', 'Já existe uma categoria com este nome');
    const created = { id: nextId(operationalDb.categories), name, active: true };
    operationalDb.categories.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('/api/categories/:id', async ({ params, request }) => {
    await delay(180);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'categories:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const category = operationalDb.categories.find((item) => item.id === Number(params.id));
    if (!category) return errorResponse(404, 'NOT_FOUND', 'Categoria não encontrada');
    const body = (await request.json()) as Partial<UpdateCategoryPayload>;
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'O nome não pode ser vazio');
      if (operationalDb.categories.some((item) => item.id !== category.id && item.name.toLowerCase() === name.toLowerCase())) return errorResponse(409, 'CONFLICT', 'Já existe uma categoria com este nome');
      category.name = name;
    }
    if (body.active !== undefined) category.active = body.active;
    return HttpResponse.json(category);
  }),

  http.post('/api/requests/:id/provision', async ({ params }) => {
    await delay(250);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'budget:manage')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const target = operationalDb.requests.find((item) => item.id === Number(params.id));
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (target.status !== 'AWAITING_BALANCE') return errorResponse(409, 'CONFLICT', 'A solicitação não aguarda provisionamento');
    const budget = target.budget && operationalDb.budgets.find((item) => item.id === target.budget!.id);
    if (!budget) return errorResponse(404, 'NOT_FOUND', 'Orçamento não encontrado');
    const amount = Number(target.amount);
    if (amount > Number(budget.balance.available)) return errorResponse(422, 'BUSINESS_RULE', 'Saldo insuficiente para provisionar a solicitação');
    const now = new Date().toISOString();
    addLedgerEntry(budget.id, actor.id, { type: 'PROVISION', amount: target.amount, requestId: target.id, justification: null }, now);
    target.amounts.provisioned = target.amount;
    target.status = 'PROVISIONED';
    addTimeline(target, actor.id, 'REQUEST_STATUS_CHANGED', 'AWAITING_BALANCE', 'PROVISIONED', null, now);
    return HttpResponse.json(target);
  }),

  http.post('/api/requests/:id/payment', async ({ params, request }) => {
    await delay(280);
    const actor = sessionActor();
    if (!actor) return errorResponse(401, 'UNAUTHORIZED', 'Autenticação necessária');
    if (!hasPermission(actor, 'payments:record')) return errorResponse(403, 'FORBIDDEN', 'Permissão insuficiente');
    const target = operationalDb.requests.find((item) => item.id === Number(params.id));
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (target.status !== 'PROVISIONED') return errorResponse(409, 'CONFLICT', 'A solicitação não está provisionada');
    const body = (await request.json()) as Partial<PaymentPayload>;
    const paid = typeof body.paidAmount === 'string' ? money(body.paidAmount) : null;
    if (!paid) return errorResponse(422, 'BUSINESS_RULE', 'O valor pago deve ser maior que zero');
    const provisioned = Number(target.amounts.provisioned ?? '0');
    const justification = body.justification?.trim() || null;
    if (paid !== provisioned && !justification) return errorResponse(422, 'BUSINESS_RULE', 'Informe a justificativa: o valor pago difere do provisionado');
    const budget = target.budget && operationalDb.budgets.find((item) => item.id === target.budget!.id);
    if (!budget) return errorResponse(404, 'NOT_FOUND', 'Orçamento não encontrado');
    const difference = paid - provisioned;
    if (difference > Number(budget.balance.available)) return errorResponse(422, 'BUSINESS_RULE', 'O saldo disponível não cobre a diferença do pagamento');
    const now = new Date().toISOString();
    if (difference > 0) addLedgerEntry(budget.id, actor.id, { type: 'PROVISION', amount: moneyOut(difference), requestId: target.id, justification }, now);
    addLedgerEntry(budget.id, actor.id, { type: 'SPEND', amount: moneyOut(paid), requestId: target.id, justification }, now);
    if (difference < 0) addLedgerEntry(budget.id, actor.id, { type: 'RELEASE', amount: moneyOut(Math.abs(difference)), requestId: target.id, justification }, now);
    const payment = { id: Math.max(0, ...operationalDb.requests.map((item) => item.payment?.id ?? 0)) + 1, requestId: target.id, paidAmount: moneyOut(paid), justification, paidAt: now };
    target.payment = { id: payment.id, paidAmount: payment.paidAmount, justification, paidAt: now };
    target.amounts.provisioned = '0.00';
    target.amounts.paid = payment.paidAmount;
    target.status = 'PAID';
    addTimeline(target, actor.id, 'REQUEST_STATUS_CHANGED', 'PROVISIONED', 'PAID', null, now);
    addTimeline(target, actor.id, 'PAYMENT_RECORDED', null, null, justification, now);
    return HttpResponse.json({ payment, balance: budget.balance }, { status: 201 });
  }),

  // ============================================================
  // Gestão de Usuários e Vigências (/api/users)
  // ============================================================
  http.get('/api/users', async () => {
    await delay(300);
    const data = [...mockDb.users];
    return HttpResponse.json(
      {
        data,
        total: data.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      { status: 200 },
    );
  }),

  http.post('/api/users/invite', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as InviteUserPayload;

    if (body.role === 'HEAD') {
      const existingHead = findActiveHeadUser();
      if (existingHead) {
        return errorResponse(
          409,
          'ACTIVE_HEAD_EXISTS',
          `Já existe um Chefe de Departamento com mandato vigente (${existingHead.name}).`,
        );
      }
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: body.name,
      email: body.email.trim().toLowerCase(),
      active: true,
      profiles: [
        {
          id: `p-${Date.now()}`,
          role: body.role,
          startsAt: body.startsAt,
          endsAt: body.endsAt || null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    mockDb.users = [newUser, ...mockDb.users];
    return HttpResponse.json(newUser, { status: 201 });
  }),

  http.post('/api/users/:userId/profiles', async ({ params, request }) => {
    await delay(400);
    const userId = String(params.userId);
    const userIdx = mockDb.users.findIndex((u) => u.id === userId);
    if (userIdx === -1) {
      return errorResponse(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }

    const user = mockDb.users[userIdx];
    if (!user.active) {
      return errorResponse(
        409,
        'USER_INACTIVE',
        'Não é possível atribuir perfis a um usuário desativado.',
      );
    }

    const body = (await request.json()) as Omit<AssignProfilePayload, 'userId'>;
    if (body.role === 'HEAD') {
      const existingHead = findActiveHeadUser();
      if (existingHead) {
        return errorResponse(
          409,
          'ACTIVE_HEAD_EXISTS',
          `Já existe um Chefe de Departamento com mandato vigente (${existingHead.name}).`,
        );
      }
    }

    const now = new Date().toISOString();
    const newProfile: ProfileTenure = {
      id: `p-${Date.now()}`,
      role: body.role,
      startsAt: body.startsAt,
      endsAt: body.endsAt || null,
    };

    const updatedUser: User = {
      ...user,
      profiles: [...user.profiles, newProfile],
      updatedAt: now,
    };
    mockDb.users[userIdx] = updatedUser;
    return HttpResponse.json(updatedUser, { status: 201 });
  }),

  http.patch('/api/users/:userId/status', async ({ params, request }) => {
    await delay(350);
    const userId = String(params.userId);
    const userIdx = mockDb.users.findIndex((u) => u.id === userId);
    if (userIdx === -1) {
      return errorResponse(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }

    const body = (await request.json()) as { active?: boolean };
    if (typeof body.active !== 'boolean') {
      return errorResponse(400, 'INVALID_STATUS', 'Informe o campo active.');
    }

    const now = new Date().toISOString();
    const updatedUser: User = {
      ...mockDb.users[userIdx],
      active: body.active,
      updatedAt: now,
    };
    mockDb.users[userIdx] = updatedUser;
    return HttpResponse.json(updatedUser, { status: 200 });
  }),

  http.patch(
    '/api/users/:userId/profiles/:profileId/end',
    async ({ params }) => {
      await delay(400);
      const userId = String(params.userId);
      const profileId = String(params.profileId);

      const userIdx = mockDb.users.findIndex((u) => u.id === userId);
      if (userIdx === -1) {
        return errorResponse(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
      }

      const user = mockDb.users[userIdx];
      const profIdx = user.profiles.findIndex((p) => p.id === profileId);
      if (profIdx === -1) {
        return errorResponse(404, 'PROFILE_NOT_FOUND', 'Perfil não encontrado.');
      }

      const now = new Date().toISOString();
      const updatedProfiles = user.profiles.map((p) =>
        p.id === profileId ? { ...p, endsAt: now } : p,
      );
      const updatedUser: User = {
        ...user,
        profiles: updatedProfiles,
        updatedAt: now,
      };
      mockDb.users[userIdx] = updatedUser;
      return HttpResponse.json(updatedUser, { status: 200 });
    },
  ),
];
