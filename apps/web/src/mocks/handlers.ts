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
  saveUserAvatar,
  setSessionUserId,
  toAuthUser,
} from './db';
import type {
  AssignProfilePayload,
  CreateRequestPayload,
  InviteUserPayload,
  LoginPayload,
  ProfileTenure,
  Request,
  UpdateAvatarPayload,
  UpdateRequestPayload,
  User,
} from '@/types';

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

    return HttpResponse.json(
      {
        authenticated: true,
        user: toAuthUser(user),
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
    const authUser = toAuthUser(user);

    return HttpResponse.json({ user: authUser }, { status: 200 });
  }),

  http.post('/api/auth/logout', async () => {
    await delay(150);
    setSessionUserId(null);
    return HttpResponse.json({ success: true }, { status: 200 });
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
    const body = (await request.json()) as { email?: string };
    return HttpResponse.json(
      {
        message: `Link de redefinição de senha enviado para ${body.email ?? ''}`,
      },
      { status: 200 },
    );
  }),

  http.post('/api/auth/reset-password', async () => {
    await delay(350);
    return HttpResponse.json(
      { message: 'Senha redefinida com sucesso!' },
      { status: 200 },
    );
  }),

  // ============================================================
  // Solicitações Financeiras (/api/requests)
  // ============================================================
  http.get('/api/requests', async () => {
    await delay(400);
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

  http.patch('/api/requests/:id/cancel', ({ params }) =>
    handleCancelRequest(String(params.id)),
  ),

  http.post('/api/requests/:id/cancel', ({ params }) =>
    handleCancelRequest(String(params.id)),
  ),

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
