import type { RequestStatus } from '@/types';

/** Status em que o valor solicitado já foi aprovado/liquidado e não pode mais ser alterado */
const AMOUNT_LOCKED_STATUSES: ReadonlySet<RequestStatus> = new Set([
  'PROVISIONED',
  'PAID',
]);

/** Status terminais em que a solicitação não pode mais ser editada ou cancelada */
const NON_MODIFIABLE_STATUSES: ReadonlySet<RequestStatus> = new Set([
  'PAID',
  'REJECTED',
  'CANCELED',
]);

/**
 * Indica se o campo de valor (`amount`) deve permanecer travado na edição.
 * Regra de negócio: após aprovação (`PROVISIONED` ou `PAID`), o valor é imutável.
 */
export function isAmountLocked(status: RequestStatus): boolean {
  return AMOUNT_LOCKED_STATUSES.has(status);
}

/**
 * Indica se a solicitação pode sofrer ações de modificação (editar ou cancelar).
 * Solicitações com status `PAID`, `REJECTED` ou `CANCELED` ficam bloqueadas na UI.
 */
export function canModifyRequest(status: RequestStatus): boolean {
  return !NON_MODIFIABLE_STATUSES.has(status);
}

/** Indica se o botão "Editar" deve estar habilitado para o status atual */
export function canEditRequest(status: RequestStatus): boolean {
  return canModifyRequest(status);
}

/** Indica se o botão "Cancelar" deve estar habilitado para o status atual */
export function canCancelRequest(status: RequestStatus): boolean {
  return canModifyRequest(status);
}

