import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const AUTH_SESSION_QUERY_KEY = ['auth', 'me'] as const;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Envelope padrão de erro retornado pelo backend Node.js/Express */
export interface BackendErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

/** Erro HTTP estruturado com código de domínio do backend */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions extends RequestInit {
  /** Evita redirecionamento global em chamadas explícitas (se necessário) */
  skipAuthRedirect?: boolean;
  /** Suprime a exibição automática do toast de erro */
  skipErrorToast?: boolean;
}

type AuthRedirectHandler = () => void;
let authRedirectHandler: AuthRedirectHandler | null = null;

/**
 * Registra o callback do Router para redirecionamento SPA imediato em 401/403.
 */
export function registerAuthRedirectHandler(
  handler: AuthRedirectHandler | null,
): void {
  authRedirectHandler = handler;
}

function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=');
    if (rawName === 'XSRF-TOKEN' || rawName === 'csrfToken' || rawName === 'csrf_token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

async function parseErrorEnvelope(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message =
    response.status === 401
      ? 'Sua sessão expirou. Faça login novamente.'
      : response.status === 403
        ? 'Acesso negado para o perfil ou vigência atual.'
        : `Erro na requisição (${response.status}).`;

  try {
    const body = (await response.json()) as BackendErrorEnvelope;
    if (body?.error?.code) {
      code = body.error.code;
    }
    if (body?.error?.message) {
      message = body.error.message;
    } else if (body?.message) {
      message = body.message;
    }
  } catch {
    // Corpo não-JSON: mantém mensagem padrão do status HTTP
  }

  return new ApiError(message, response.status, code);
}

/**
 * Limpa o cache local do TanStack Query e redireciona imediatamente para `/login`.
 */
function handleSessionFailure(): void {
  void queryClient.cancelQueries();
  queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, {
    authenticated: false,
    user: null,
  });
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== 'auth',
  });
  queryClient.getMutationCache().clear();

  const currentPathname = globalThis.location?.pathname;
  if (currentPathname !== '/login') {
    if (authRedirectHandler) {
      authRedirectHandler();
    } else if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }
}

function buildUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/') && API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, '')}${input}`;
  }
  return input;
}

/**
 * Cliente HTTP centralizado preparado para autenticação baseada em cookies `httpOnly`,
 * `SameSite=Lax`, proteção CSRF e interceptação global de erros 401/403.
 */
export async function apiRequest<T>(
  input: RequestInfo | URL,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { skipAuthRedirect = false, skipErrorToast = false, ...init } = options;

  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfTokenFromCookie();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(buildUrl(input), {
    ...init,
    method,
    headers,
    // Obrigatório para envio automático de cookies httpOnly / SameSite=Lax
    credentials: 'include',
  });

  if (!response.ok) {
    const apiError = await parseErrorEnvelope(response);

    if (!skipErrorToast) {
      const title =
        response.status === 401
          ? 'Sessão expirada'
          : response.status === 403
            ? 'Acesso negado'
            : 'Erro na requisição';
      toast.error(apiError.message, title);
    }

    if ((response.status === 401 || response.status === 403) && !skipAuthRedirect) {
      handleSessionFailure();
    }

    throw apiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
