export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
}

type Listener = () => void;

const TOAST_DURATION_MS = 5000;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function pushToast(variant: ToastVariant, message: string, title?: string): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [...toasts, { id, variant, message, title }];
  emit();

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      dismissToast(id);
    }, TOAST_DURATION_MS);
  }

  return id;
}

export function dismissToast(id: string): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

export function clearToasts(): void {
  if (toasts.length > 0) {
    toasts = [];
    emit();
  }
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToastsSnapshot(): ToastItem[] {
  return toasts;
}

export const toast = {
  error: (message: string, title = 'Erro na operação') =>
    pushToast('error', message, title),
  success: (message: string, title = 'Sucesso') =>
    pushToast('success', message, title),
  info: (message: string, title?: string) => pushToast('info', message, title),
  dismiss: dismissToast,
  clear: clearToasts,
};

