import {
  getActiveRoles,
  isTenureActive,
  resolvePrimaryRole,
} from '@/lib/auth-rules';
import type {
  AuthUser,
  FinancialSummary,
  Request,
  User,
} from '@/types';

const MOCK_SERVER_SESSION_KEY = 'dacom_mock_http_only_session_uid';
const MOCK_AVATARS_STORAGE_KEY = 'dacom_mock_user_avatars';
const LOGGED_OUT_MARKER = '__LOGGED_OUT__';
const ACCUMULATED_LIMIT_CENTS = 800000; // R$ 8.000,00

const initialRequests: Request[] = [
  {
    id: 'req-001',
    userId: 'usr-1',
    category: 'MATERIAL_CONSUMO',
    description: 'Filamento 3D PLA e ABS para prototipagem no Lab de Robótica',
    amount: 48000, // R$ 480,00
    status: 'PAID',
    attachmentName: 'nota_fiscal_filamento.pdf',
    attachmentUrl: '#',
    createdAt: '2026-10-18T14:30:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: 'req-002',
    userId: 'usr-1',
    category: 'EQUIPAMENTOS',
    description: 'Kit de Sensores IoT e placas ESP32 para disciplina de Redes',
    amount: 145000, // R$ 1.450,00
    status: 'PROVISIONED',
    attachmentName: 'cotacao_placas.pdf',
    attachmentUrl: '#',
    createdAt: '2026-10-29T09:15:00Z',
    updatedAt: '2026-11-02T16:20:00Z',
  },
  {
    id: 'req-003',
    userId: 'usr-1',
    category: 'DIARIAS_PASSAGENS',
    description: 'Inscrição e diária para congresso SBBD 2026',
    amount: 198000, // R$ 1.980,00
    status: 'IN_VOTING',
    attachmentName: 'artigo_aceito_sbbd.pdf',
    attachmentUrl: '#',
    createdAt: '2026-11-04T11:00:00Z',
    updatedAt: '2026-11-04T11:00:00Z',
  },
  {
    id: 'req-004',
    userId: 'usr-1',
    category: 'SERVICOS_TERCEIROS',
    description: 'Calibração técnica de osciloscópios do laboratório de Hardware',
    amount: 85000, // R$ 850,00
    status: 'AWAITING_VOTING',
    attachmentName: 'proposta_calibracao.pdf',
    attachmentUrl: '#',
    createdAt: '2026-11-06T15:40:00Z',
    updatedAt: '2026-11-06T15:40:00Z',
  },
  {
    id: 'req-005',
    userId: 'usr-1',
    category: 'MATERIAL_CONSUMO',
    description: 'Cabos de rede Cat6 blindados e conectores RJ45 industriais',
    amount: 32000, // R$ 320,00
    status: 'AWAITING_BALANCE',
    attachmentName: 'orcamento_cabos.pdf',
    attachmentUrl: '#',
    createdAt: '2026-11-07T08:20:00Z',
    updatedAt: '2026-11-07T08:20:00Z',
  },
  {
    id: 'req-006',
    userId: 'usr-1',
    category: 'OUTROS',
    description: 'Licença anual de software acadêmico de simulação',
    amount: 250000, // R$ 2.500,00
    status: 'REJECTED',
    attachmentName: 'justificativa_licenca.pdf',
    attachmentUrl: '#',
    createdAt: '2026-10-10T16:00:00Z',
    updatedAt: '2026-10-14T09:30:00Z',
  },
];

const initialUsers: User[] = [
  {
    id: 'usr-1',
    name: 'Prof. João Carlos Silva',
    email: 'joaosilva@utfpr.edu.br',
    active: true,
    profiles: [
      { id: 'p1', role: 'PROFESSOR', startsAt: '2021-02-01T00:00:00Z', endsAt: null },
    ],
    createdAt: '2021-02-01T00:00:00Z',
    updatedAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'usr-2',
    name: 'Profa. Dra. Maria Santos',
    email: 'mariasantos@utfpr.edu.br',
    active: true,
    profiles: [
      { id: 'p2', role: 'PROFESSOR', startsAt: '2019-08-01T00:00:00Z', endsAt: null },
      { id: 'p3', role: 'COUNCIL_MEMBER', startsAt: '2025-01-01T00:00:00Z', endsAt: '2026-12-31T00:00:00Z' },
    ],
    createdAt: '2019-08-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-3',
    name: 'Prof. Dr. Ricardo Oliveira (Chefia)',
    email: 'dacom-chefia@utfpr.edu.br',
    active: true,
    profiles: [
      { id: 'p4', role: 'PROFESSOR', startsAt: '2017-03-01T00:00:00Z', endsAt: null },
      { id: 'p5', role: 'HEAD', startsAt: '2025-06-01T00:00:00Z', endsAt: '2027-05-31T00:00:00Z' },
    ],
    createdAt: '2017-03-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'usr-4',
    name: 'Ana Paula Ferreira (Financeiro)',
    email: 'financeiro-dacom@utfpr.edu.br',
    active: true,
    profiles: [
      { id: 'p6', role: 'FINANCIAL_ADMIN', startsAt: '2022-01-01T00:00:00Z', endsAt: null },
    ],
    createdAt: '2022-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'usr-5',
    name: 'Prof. Marcos Vinicius Costa',
    email: 'marcoscosta@utfpr.edu.br',
    active: false,
    profiles: [
      { id: 'p7', role: 'PROFESSOR', startsAt: '2016-03-01T00:00:00Z', endsAt: '2025-12-31T00:00:00Z' },
    ],
    createdAt: '2016-03-01T00:00:00Z',
    updatedAt: '2025-12-31T00:00:00Z',
  },
];

let memorySessionUserId: string | null | undefined;

function loadStoredAvatars(): Record<string, string | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(MOCK_AVATARS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, string | null>;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function saveUserAvatar(userId: string, avatarUrl: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const avatars = loadStoredAvatars();
      avatars[userId] = avatarUrl;
      localStorage.setItem(MOCK_AVATARS_STORAGE_KEY, JSON.stringify(avatars));
    }
  } catch {
    // ignore storage errors
  }
}

const storedAvatars = loadStoredAvatars();

export const mockDb: {
  requests: Request[];
  users: User[];
} = {
  requests: [...initialRequests],
  users: initialUsers.map((u) => ({
    ...u,
    avatarUrl:
      u.id in storedAvatars ? storedAvatars[u.id] : (u.avatarUrl ?? null),
  })),
};

/**
 * Simula o estado de sessão do servidor (cookie httpOnly) sem expor tokens ao cliente.
 */
export function getSessionUserId(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(MOCK_SERVER_SESSION_KEY);
      if (stored === LOGGED_OUT_MARKER) return null;
      if (stored) return stored;
    }
  } catch {
    // Fallback em ambiente sem sessionStorage
  }
  if (memorySessionUserId === null) return null;
  if (typeof memorySessionUserId === 'string') return memorySessionUserId;
  return 'usr-1';
}

export function setSessionUserId(userId: string | null): void {
  memorySessionUserId = userId;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (userId === null) {
        sessionStorage.setItem(MOCK_SERVER_SESSION_KEY, LOGGED_OUT_MARKER);
      } else {
        sessionStorage.setItem(MOCK_SERVER_SESSION_KEY, userId);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function toAuthUser(user: User): AuthUser {
  const activeRoles = getActiveRoles(user.profiles, user.active);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    avatarUrl: user.avatarUrl ?? null,
    profiles: user.profiles,
    activeRoles,
    availableRoles: activeRoles,
    activeRole: resolvePrimaryRole(activeRoles),
  };
}

export function findActiveHeadUser(excludeUserId?: string): User | null {
  for (const user of mockDb.users) {
    if (!user.active || (excludeUserId && user.id === excludeUserId)) continue;
    const hasActiveHead = user.profiles.some(
      (p) => p.role === 'HEAD' && isTenureActive(p),
    );
    if (hasActiveHead) return user;
  }
  return null;
}

export function computeFinancialSummary(requests: Request[]): FinancialSummary {
  const usedAmount = requests
    .filter((r) => r.status === 'PAID' || r.status === 'PROVISIONED')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return {
    accumulatedLimit: ACCUMULATED_LIMIT_CENTS,
    usedAmount,
    availableAmount: Math.max(0, ACCUMULATED_LIMIT_CENTS - usedAmount),
    periodStart: '2026-01-01T00:00:00Z',
    periodEnd: '2026-12-31T23:59:59Z',
    totalRequests: requests.length,
    approvedRequests: requests.filter(
      (r) => r.status === 'PAID' || r.status === 'PROVISIONED',
    ).length,
    pendingRequests: requests.filter((r) =>
      [
        'AWAITING_VOTING',
        'IN_VOTING',
        'AWAITING_COMPLEMENT',
        'AWAITING_BALANCE',
      ].includes(r.status),
    ).length,
    rejectedRequests: requests.filter(
      (r) => r.status === 'REJECTED' || r.status === 'CANCELED',
    ).length,
  };
}
