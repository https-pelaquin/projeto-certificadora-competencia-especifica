import { apiClient } from '@/lib/api-client';

export interface AuditActor {
  id: number;
  name: string;
  email: string;
}

export interface AuditLog {
  id: number;
  occurredAt: string;
  actorType: 'USER' | 'SYSTEM';
  actorId: number | null;
  actor: AuditActor | null;
  job: string | null;
  action: string;
  entityType: string;
  entityId: string;
  justification: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
}

export interface AuditLogPage {
  items: AuditLog[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuditFilters {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  actorId: '',
  action: '',
  entityType: '',
  entityId: '',
  from: '',
  to: '',
};

export const AUDIT_PAGE_SIZE = 15;

function dateBoundary(value: string, nextDay: boolean) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day + (nextDay ? 1 : 0)).toISOString();
}

export function fetchAuditLogs(filters: AuditFilters, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(AUDIT_PAGE_SIZE),
  });

  if (filters.actorId.trim()) params.set('actorId', filters.actorId.trim());
  if (filters.action.trim()) params.set('action', filters.action.trim());
  if (filters.entityType.trim()) params.set('entityType', filters.entityType.trim());
  if (filters.entityId.trim()) params.set('entityId', filters.entityId.trim());
  if (filters.from) params.set('from', dateBoundary(filters.from, false));
  // A API usa limite superior exclusivo: dia seguinte à meia-noite local.
  if (filters.to) params.set('to', dateBoundary(filters.to, true));

  return apiClient.get<AuditLogPage>(`/api/audit-logs?${params.toString()}`);
}
