import type { RequestStatus } from '@/types';

/** Status em que o valor solicitado ainda pode ser alterado (espelha request-edit.service.ts) */
const AMOUNT_EDITABLE_STATUSES: ReadonlySet<RequestStatus> = new Set([
  'AWAITING_VOTING',
  'AWAITING_COMPLEMENT',
]);

/** Status terminais em que a solicitação não pode mais ser editada ou cancelada */
const NON_MODIFIABLE_STATUSES: ReadonlySet<RequestStatus> = new Set([
  'PAID',
  'REJECTED',
  'CANCELED',
]);

/**
 * Indica se o campo de valor (`amount`) deve permanecer travado na edição.
 * Regra de negócio do backend: o valor só pode ser alterado em `AWAITING_VOTING` ou `AWAITING_COMPLEMENT`.
 */
export function isAmountLocked(status: RequestStatus): boolean {
  return !AMOUNT_EDITABLE_STATUSES.has(status);
}

/**
 * Indica se a solicitação pode sofrer ações de modificação (editar ou cancelar).
 * Solicitações com status `PAID`, `REJECTED` ou `CANCELED` ficam bloqueadas na UI.
 */
export function canModifyRequest(status: RequestStatus): boolean {
  return !NON_MODIFIABLE_STATUSES.has(status);
}

/** Indica se o botão "Editar" deve estar habilitado (prioriza flag `canEdit` da API quando presente) */
export function canEditRequest(status: RequestStatus, canEdit?: boolean): boolean {
  if (typeof canEdit === 'boolean') return canEdit;
  return canModifyRequest(status);
}

/** Indica se o botão "Cancelar" deve estar habilitado (prioriza flag `canCancel` da API quando presente) */
export function canCancelRequest(status: RequestStatus, canCancel?: boolean): boolean {
  if (typeof canCancel === 'boolean') return canCancel;
  return canModifyRequest(status);
}

