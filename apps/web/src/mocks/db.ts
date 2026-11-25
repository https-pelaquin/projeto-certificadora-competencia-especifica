import {
  getActiveRoles,
  isTenureActive,
  resolvePrimaryRole,
} from '@/lib/auth-rules';
import type {
  AuthUser,
  Permission,
  User,
} from '@/types';
import type {
  ApprovalLimit,
  Budget,
  ExpenseCategory as OperationalCategory,
  LedgerEntry,
} from '@/types/finance';
import type { OperationalRequest } from '@/types/operational-request';
import type {
  VotingComment,
  VotingRecord,
  VotingTieBreak,
  VotingVote,
} from '@/types/voting';

const MOCK_SERVER_SESSION_KEY = 'dacom_mock_http_only_session_uid';
const LOGGED_OUT_MARKER = '__LOGGED_OUT__';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PROFESSOR: ['requests:create'],
  COUNCIL_MEMBER: [
    'requests:create',
    'votings:vote',
    'votings:comment',
  ],
  HEAD: [
    'requests:create',
    'requests:readAll',
    'requests:requestComplement',
    'requests:cancelAny',
    'votings:open',
    'votings:tieBreak',
    'votings:comment',
    'budget:manage',
    'budget:read',
    'limits:manage',
    'categories:manage',
    'payments:record',
    'users:manage',
    'dashboard:read',
    'reports:read',
    'audit:read',
  ],
  FINANCIAL_ADMIN: [
    'requests:readAll',
    'budget:read',
    'dashboard:read',
    'reports:read',
    'audit:read',
  ],
};

const initialUsers: User[] = [
  {
    id: 1,
    name: 'Prof. João Carlos Silva',
    email: 'joaosilva@utfpr.edu.br',
    active: true,
    invitePending: false,
    roles: ['PROFESSOR'],
    roleAssignments: [
      { id: 1, role: 'PROFESSOR', startsAt: '2021-02-01T00:00:00Z', endsAt: null, current: true },
    ],
    createdAt: '2021-02-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Profa. Dra. Maria Santos',
    email: 'mariasantos@utfpr.edu.br',
    active: true,
    invitePending: false,
    roles: ['PROFESSOR', 'COUNCIL_MEMBER'],
    roleAssignments: [
      { id: 2, role: 'PROFESSOR', startsAt: '2019-08-01T00:00:00Z', endsAt: null, current: true },
      { id: 3, role: 'COUNCIL_MEMBER', startsAt: '2025-01-01T00:00:00Z', endsAt: '2026-12-31T00:00:00Z', current: true },
    ],
    createdAt: '2019-08-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Prof. Dr. Ricardo Oliveira (Chefia)',
    email: 'dacom-chefia@utfpr.edu.br',
    active: true,
    invitePending: false,
    roles: ['PROFESSOR', 'HEAD'],
    roleAssignments: [
      { id: 4, role: 'PROFESSOR', startsAt: '2017-03-01T00:00:00Z', endsAt: null, current: true },
      { id: 5, role: 'HEAD', startsAt: '2025-06-01T00:00:00Z', endsAt: '2027-05-31T00:00:00Z', current: true },
    ],
    createdAt: '2017-03-01T00:00:00Z',
  },
  {
    id: 4,
    name: 'Ana Paula Ferreira (Financeiro)',
    email: 'financeiro-dacom@utfpr.edu.br',
    active: true,
    invitePending: false,
    roles: ['FINANCIAL_ADMIN'],
    roleAssignments: [
      { id: 6, role: 'FINANCIAL_ADMIN', startsAt: '2022-01-01T00:00:00Z', endsAt: null, current: true },
    ],
    createdAt: '2022-01-01T00:00:00Z',
  },
  {
    id: 5,
    name: 'Prof. Marcos Vinicius Costa',
    email: 'marcoscosta@utfpr.edu.br',
    active: false,
    invitePending: false,
    roles: [],
    roleAssignments: [
      { id: 7, role: 'PROFESSOR', startsAt: '2016-03-01T00:00:00Z', endsAt: '2025-12-31T00:00:00Z', current: false },
    ],
    createdAt: '2016-03-01T00:00:00Z',
  },
];

let memorySessionUserId: string | null | undefined;

export const mockDb: {
  users: User[];
} = {
  users: initialUsers,
};

export interface MockVoting extends VotingRecord {
  memberIds: number[];
  votes: VotingVote[];
  comments: VotingComment[];
  tieBreak: VotingTieBreak | null;
}

const operationalRequests: OperationalRequest[] = [
  {
    id: 101,
    status: 'AWAITING_VOTING',
    description: 'Aquisição de componentes para manutenção dos laboratórios',
    amount: '1850.00',
    createdAt: '2026-11-05T13:00:00.000Z',
    updatedAt: '2026-11-05T13:00:00.000Z',
    requester: { id: 1, name: initialUsers[0].name },
    category: { id: 1, name: 'Material de consumo' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '1850.00', provisioned: null, paid: null },
    payment: null,
    complementRequests: [],
    timeline: [
      {
        at: '2026-11-05T13:00:00.000Z',
        action: 'REQUEST_CREATED',
        actor: { id: 1, name: initialUsers[0].name },
        fromStatus: null,
        toStatus: 'AWAITING_VOTING',
        justification: null,
      },
    ],
  },
  {
    id: 102,
    status: 'AWAITING_BALANCE',
    description: 'Inscrição de docente em congresso nacional de computação',
    amount: '2300.00',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-28T17:00:00.000Z',
    requester: { id: 1, name: initialUsers[0].name },
    category: { id: 4, name: 'Diárias e passagens' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '2300.00', provisioned: null, paid: null },
    payment: null,
    complementRequests: [],
    timeline: [
      {
        at: '2026-10-20T10:00:00.000Z',
        action: 'REQUEST_CREATED',
        actor: { id: 1, name: initialUsers[0].name },
        fromStatus: null,
        toStatus: 'AWAITING_VOTING',
        justification: null,
      },
      {
        at: '2026-10-28T17:00:00.000Z',
        action: 'REQUEST_STATUS_CHANGED',
        actor: null,
        fromStatus: 'IN_VOTING',
        toStatus: 'AWAITING_BALANCE',
        justification: null,
      },
    ],
  },
  {
    id: 103,
    status: 'PROVISIONED',
    description: 'Licenças anuais para ferramentas de desenvolvimento',
    amount: '1200.00',
    createdAt: '2026-09-12T12:00:00.000Z',
    updatedAt: '2026-10-02T15:30:00.000Z',
    requester: { id: 2, name: initialUsers[1].name },
    category: { id: 3, name: 'Serviços de terceiros' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '1200.00', provisioned: '1200.00', paid: null },
    payment: null,
    complementRequests: [],
    timeline: [
      {
        at: '2026-09-12T12:00:00.000Z',
        action: 'REQUEST_CREATED',
        actor: { id: 2, name: initialUsers[1].name },
        fromStatus: null,
        toStatus: 'AWAITING_VOTING',
        justification: null,
      },
      {
        at: '2026-10-02T15:30:00.000Z',
        action: 'REQUEST_STATUS_CHANGED',
        actor: { id: 3, name: initialUsers[2].name },
        fromStatus: 'AWAITING_BALANCE',
        toStatus: 'PROVISIONED',
        justification: null,
      },
    ],
  },
  {
    id: 104,
    status: 'PAID',
    description: 'Materiais elétricos para bancada de sistemas embarcados',
    amount: '480.00',
    createdAt: '2026-08-04T09:00:00.000Z',
    updatedAt: '2026-08-25T16:45:00.000Z',
    requester: { id: 1, name: initialUsers[0].name },
    category: { id: 1, name: 'Material de consumo' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '480.00', provisioned: '0.00', paid: '450.00' },
    payment: {
      id: 1,
      paidAmount: '450.00',
      justification: 'Desconto obtido na compra.',
      paidAt: '2026-08-25T16:45:00.000Z',
    },
    complementRequests: [],
    timeline: [
      {
        at: '2026-08-04T09:00:00.000Z',
        action: 'REQUEST_CREATED',
        actor: { id: 1, name: initialUsers[0].name },
        fromStatus: null,
        toStatus: 'AWAITING_VOTING',
        justification: null,
      },
      {
        at: '2026-08-25T16:45:00.000Z',
        action: 'REQUEST_STATUS_CHANGED',
        actor: { id: 3, name: initialUsers[2].name },
        fromStatus: 'PROVISIONED',
        toStatus: 'PAID',
        justification: null,
      },
    ],
  },
  {
    id: 105,
    status: 'IN_VOTING',
    description: 'Renovação de equipamentos de rede do laboratório',
    amount: '3400.00',
    createdAt: '2026-11-10T11:00:00.000Z',
    updatedAt: '2026-11-20T14:00:00.000Z',
    requester: { id: 1, name: initialUsers[0].name },
    category: { id: 2, name: 'Equipamentos' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '3400.00', provisioned: null, paid: null },
    payment: null,
    complementRequests: [],
    timeline: [
      {
        at: '2026-11-20T14:00:00.000Z',
        action: 'VOTING_OPENED',
        actor: { id: 3, name: initialUsers[2].name },
        fromStatus: 'AWAITING_VOTING',
        toStatus: 'IN_VOTING',
        justification: null,
      },
    ],
  },
  {
    id: 106,
    status: 'IN_VOTING',
    description: 'Contratação de manutenção preventiva de projetores',
    amount: '950.00',
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-11-15T18:00:00.000Z',
    requester: { id: 1, name: initialUsers[0].name },
    category: { id: 3, name: 'Serviços de terceiros' },
    budget: { id: 1, year: 2026 },
    approvalLimit: { id: 1, amount: '8000.00', periodMonths: 12 },
    amounts: { requested: '950.00', provisioned: null, paid: null },
    payment: null,
    complementRequests: [],
    timeline: [
      {
        at: '2026-10-15T14:00:00.000Z',
        action: 'VOTING_OPENED',
        actor: { id: 3, name: initialUsers[2].name },
        fromStatus: 'AWAITING_VOTING',
        toStatus: 'IN_VOTING',
        justification: null,
      },
    ],
  },
];

const budgets: Budget[] = [
  {
    id: 1,
    year: 2026,
    initialAmount: '100000.00',
    createdAt: '2026-01-05T12:00:00.000Z',
    balance: {
      total: '100000.00',
      available: '98350.00',
      provisioned: '1200.00',
      spent: '450.00',
    },
  },
];

const ledger: Record<number, LedgerEntry[]> = {
  1: [
    { id: 5, type: 'RELEASE', amount: '30.00', requestId: 104, justification: 'Desconto obtido na compra.', createdBy: { id: 3, name: initialUsers[2].name }, createdAt: '2026-08-25T16:45:00.000Z' },
    { id: 4, type: 'SPEND', amount: '450.00', requestId: 104, justification: 'Desconto obtido na compra.', createdBy: { id: 3, name: initialUsers[2].name }, createdAt: '2026-08-25T16:45:00.000Z' },
    { id: 3, type: 'PROVISION', amount: '1200.00', requestId: 103, justification: null, createdBy: { id: 3, name: initialUsers[2].name }, createdAt: '2026-10-02T15:30:00.000Z' },
    { id: 2, type: 'PROVISION', amount: '480.00', requestId: 104, justification: null, createdBy: { id: 3, name: initialUsers[2].name }, createdAt: '2026-08-16T11:00:00.000Z' },
  ],
};

const votings: MockVoting[] = [
  {
    id: 1,
    requestId: 105,
    openedById: 3,
    openedAt: '2026-11-20T14:00:00.000Z',
    deadline: '2026-12-15T23:59:59.000Z',
    status: 'OPEN',
    result: null,
    approveCount: null,
    rejectCount: null,
    abstainCount: null,
    closedAt: null,
    memberIds: [2],
    votes: [],
    comments: [
      { id: 1, votingId: 1, authorId: 3, body: 'Verifiquem a compatibilidade dos equipamentos propostos.', createdAt: '2026-11-21T10:00:00.000Z', author: { id: 3, name: initialUsers[2].name } },
    ],
    tieBreak: null,
  },
  {
    id: 2,
    requestId: 106,
    openedById: 3,
    openedAt: '2026-10-15T14:00:00.000Z',
    deadline: '2026-11-15T17:59:59.000Z',
    status: 'AWAITING_TIE_BREAK',
    result: null,
    approveCount: 0,
    rejectCount: 0,
    abstainCount: 1,
    closedAt: null,
    memberIds: [2],
    votes: [{ votingId: 2, userId: 2, choice: 'ABSTAIN', createdAt: '2026-11-01T13:00:00.000Z' }],
    comments: [],
    tieBreak: null,
  },
];

export const operationalDb: {
  requests: OperationalRequest[];
  budgets: Budget[];
  ledger: Record<number, LedgerEntry[]>;
  approvalLimits: ApprovalLimit[];
  categories: OperationalCategory[];
  votings: MockVoting[];
} = {
  requests: operationalRequests,
  budgets,
  ledger,
  approvalLimits: [
    { id: 1, amount: '8000.00', periodMonths: 12, validFrom: '2026-01-01T00:00:00.000Z', validUntil: null },
  ],
  categories: [
    { id: 1, name: 'Material de consumo', active: true },
    { id: 2, name: 'Equipamentos', active: true },
    { id: 3, name: 'Serviços de terceiros', active: true },
    { id: 4, name: 'Diárias e passagens', active: true },
    { id: 5, name: 'Categoria descontinuada', active: false },
  ],
  votings,
};

export function numericUserId(userId: string): number | null {
  const num = Number(userId);
  if (Number.isInteger(num) && num > 0) return num;
  const match = /^usr-(\d+)$/.exec(userId);
  return match ? Number(match[1]) : null;
}

export function stringUserId(userId: number): string {
  return String(userId);
}

export function permissionsForUser(user: User): Permission[] {
  const permissions = getActiveRoles(user.roleAssignments, user.active).flatMap(
    (role) => ROLE_PERMISSIONS[role] ?? [],
  );
  return [...new Set(permissions)];
}

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
  return '1';
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
  const activeRoles = getActiveRoles(user.roleAssignments, user.active);
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    active: user.active,
    activeRoles,
    availableRoles: activeRoles,
    activeRole: resolvePrimaryRole(activeRoles),
    permissions: permissionsForUser(user),
  };
}

export function findActiveHeadUser(excludeUserId?: number): User | null {
  for (const user of mockDb.users) {
    if (!user.active || (excludeUserId && user.id === excludeUserId)) continue;
    const hasActiveHead = user.roleAssignments.some(
      (p) => p.role === 'HEAD' && isTenureActive(p),
    );
    if (hasActiveHead) return user;
  }
  return null;
}
