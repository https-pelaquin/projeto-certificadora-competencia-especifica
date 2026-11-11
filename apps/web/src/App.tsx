import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { ShellLayout } from '@/components/layout/shell-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { LoginPage, OverviewPage, RequestsPage, UsersPage } from '@/pages';
import { AccessDenied } from '@/components/shared';
import { registerAuthRedirectHandler } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

function ApiInterceptorBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    registerAuthRedirectHandler(() => {
      navigate('/login', { replace: true });
    });

    return () => {
      registerAuthRedirectHandler(null);
    };
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <ApiInterceptorBridge />
            <Routes>
              {/* Rota pública de Autenticação Institucional */}
              <Route path="/login" element={<LoginPage />} />

              {/* Rotas Protegidas sob o ShellLayout */}
              <Route element={<ProtectedRoute />}>
                <Route element={<ShellLayout />}>
                  {/* Visão Geral do Docente (exclusivo para perfil PROFESSOR vigente) */}
                  <Route
                    path="/docente"
                    element={
                      <ProtectedRoute allowedRoles={['PROFESSOR']}>
                        <OverviewPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Solicitações Financeiras do Docente (exclusivo para perfil PROFESSOR vigente) */}
                  <Route
                    path="/solicitacoes"
                    element={
                      <ProtectedRoute allowedRoles={['PROFESSOR']}>
                        <RequestsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Gestão de Usuários e Mandatos (exclusivo para HEAD - Chefe de Departamento vigente) */}
                  <Route
                    path="/usuarios"
                    element={
                      <ProtectedRoute allowedRoles={['HEAD']}>
                        <UsersPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Route>

              {/* Rota de Acesso Negado (403) */}
              <Route path="/acesso-negado" element={<AccessDenied />} />

              {/* Redirecionamento padrão */}
              <Route path="/" element={<Navigate to="/docente" replace />} />
              <Route path="*" element={<Navigate to="/docente" replace />} />
            </Routes>
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
