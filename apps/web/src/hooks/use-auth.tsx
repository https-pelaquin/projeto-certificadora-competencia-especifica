import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCurrentSession,
  loginWithCredentials,
  logoutSession,
} from '@/services/api';
import {
  hasActiveRole as checkActiveRole,
  hasAnyActiveRole as checkAnyActiveRole,
} from '@/lib/auth-rules';
import { requestsQueryKeys } from '@/features/requests/api';
import type { AuthSessionResponse, AuthUser, Role } from '@/types';

export const AUTH_SESSION_QUERY_KEY = ['auth', 'me'] as const;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeRole: Role | null;
  activeRoles: Role[];
  hasActiveRole: (role: Role) => boolean;
  hasAnyActiveRole: (roles: Role[]) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading } = useQuery<AuthSessionResponse>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchCurrentSession();
      } catch {
        return { authenticated: false, user: null };
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const user = sessionData?.authenticated ? sessionData.user : null;

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const response = await loginWithCredentials({
        email: email.trim().toLowerCase(),
        password,
      });

      queryClient.setQueryData<AuthSessionResponse>(AUTH_SESSION_QUERY_KEY, {
        authenticated: true,
        user: response.user,
      });
      await queryClient.invalidateQueries({ queryKey: requestsQueryKeys.all });

      return response.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      void queryClient.cancelQueries();
      queryClient.setQueryData<AuthSessionResponse>(AUTH_SESSION_QUERY_KEY, {
        authenticated: false,
        user: null,
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
      queryClient.getMutationCache().clear();
    }
  }, [queryClient]);

  const hasActiveRole = useCallback(
    (role: Role) => checkActiveRole(user, role),
    [user],
  );

  const hasAnyActiveRole = useCallback(
    (roles: Role[]) => checkAnyActiveRole(user, roles),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        activeRole: user?.activeRole ?? null,
        activeRoles: user?.activeRoles ?? [],
        hasActiveRole,
        hasAnyActiveRole,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return ctx;
}
