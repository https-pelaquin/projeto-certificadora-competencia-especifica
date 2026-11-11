import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div data-testid="access-denied-page" className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="rounded-2xl bg-red-50 border border-red-100 p-5 mb-5 shadow-xs">
        <ShieldAlert className="h-12 w-12 text-red-600" />
      </div>
      <h1 data-testid="access-denied-title" className="text-2xl font-bold text-slate-900 mb-2">Acesso Negado (403)</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
        Seu usuário não possui um perfil vigente com permissões para acessar esta tela.
        Caso acredite tratar-se de uma divergência de vigência, contate a chefia do DACOM ou entre com outra conta institucional.
      </p>
      <div className="flex items-center gap-3">
        <Button data-testid="btn-back-dashboard" onClick={() => navigate('/docente')} variant="outline" className="gap-2 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Painel
        </Button>
        <Button data-testid="btn-go-login" onClick={() => navigate('/login')} className="bg-[#164E3F] hover:bg-[#0F382C] text-white cursor-pointer">
          Ir para Login
        </Button>
      </div>
    </div>
  );
}
