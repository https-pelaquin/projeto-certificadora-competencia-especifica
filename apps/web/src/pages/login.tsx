import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle,
  Check,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { hasActiveRole } from '@/lib/auth-rules';
import { forgotPassword, resetPassword } from '@/services/api';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe o seu e-mail institucional.')
    .email('E-mail institucional inválido.')
    .refine((val) => val.toLowerCase().endsWith('@utfpr.edu.br'), {
      message:
        'Utilize obrigatoriamente seu e-mail institucional (@utfpr.edu.br).',
    }),
  password: z.string().min(6, 'A senha deve possuir ao menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Insira seu e-mail institucional (@utfpr.edu.br)')
    .email('E-mail institucional inválido')
    .refine((val) => val.toLowerCase().endsWith('@utfpr.edu.br'), {
      message: 'Insira seu e-mail institucional (@utfpr.edu.br)',
    }),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

const resetSchema = z.object({
  token: z.string().min(4, 'O token deve ter pelo menos 4 dígitos'),
  newPassword: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres'),
});

type ResetFormValues = z.infer<typeof resetSchema>;

const INSTITUTIONAL_HIGHLIGHTS = [
  'Acompanhamento completo das solicitações',
  'Deliberações seguras e centralizadas',
  'Visibilidade da execução orçamentária',
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Recovery dialog states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset' | 'success'>('request');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const forgotForm = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: '', newPassword: '' },
  });

  const onLogin = async (data: LoginFormValues) => {
    try {
      setAuthError(null);
      const authenticatedUser = await login(data.email, data.password);
      if (hasActiveRole(authenticatedUser, 'PROFESSOR')) {
        navigate('/docente');
      } else if (hasActiveRole(authenticatedUser, 'HEAD')) {
        navigate('/usuarios');
      } else {
        navigate('/acesso-negado');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha na autenticação');
    }
  };

  const handleForgotSubmit = async (data: ForgotFormValues) => {
    try {
      const res = await forgotPassword(data.email);
      setRecoveryEmail(data.email);
      setRecoveryFeedback(res.message);
      setForgotStep('reset');
    } catch {
      setRecoveryFeedback('Erro ao solicitar recuperação de senha.');
    }
  };

  const handleResetSubmit = async (data: ResetFormValues) => {
    try {
      await resetPassword(data.token, data.newPassword);
      setForgotStep('success');
    } catch {
      setRecoveryFeedback('Erro ao redefinir senha com o token fornecido.');
    }
  };

  const formErrorMessage =
    authError || errors.email?.message || errors.password?.message || null;

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#F8FAFC]">
      {/* Painel Institucional Esquerdo */}
      <aside className="relative overflow-hidden bg-[#0B2B26] text-white flex flex-col justify-between px-8 py-8 sm:px-12 lg:px-14 lg:py-10">
        {/* Círculos decorativos sutis */}
        <div className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full border border-white/[0.06]" />

        {/* Marca superior */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-emerald-400/20 text-emerald-400">
            <WalletCards className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-white">
              Gestão de Recursos
            </span>
            <span className="text-[11px] font-medium text-slate-400 tracking-wide">
              DACOM • UTFPR
            </span>
          </div>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10 my-12 lg:my-0 max-w-lg">
          <p className="text-xs font-semibold text-emerald-400 mb-3 tracking-wide">
            Portal institucional
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-white tracking-tight leading-[1.12] mb-5">
            Recursos acadêmicos com transparência e agilidade.
          </h1>
          <p className="text-sm sm:text-[15px] text-slate-300/85 leading-relaxed mb-8 max-w-md">
            Um ambiente único para solicitações, deliberações do conselho e execução financeira do departamento.
          </p>

          <ul className="space-y-3.5">
            {INSTITUTIONAL_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-400">
                  <Check className="h-3 w-3" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Rodapé institucional */}
        <p className="relative z-10 text-xs text-slate-400/80">
          Departamento Acadêmico de Computação • Câmpus Cornélio Procópio
        </p>
      </aside>

      {/* Painel Direito: Formulário de Acesso */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10 bg-[#F8FAFC]">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <p className="text-xs font-bold text-[#146C5C] mb-1.5">Bem-vindo</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Acesse sua conta
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Entre com suas credenciais institucionais.
            </p>
          </div>

          <form
            data-testid="login-form"
            onSubmit={handleSubmit(onLogin)}
            className="space-y-5"
            noValidate
          >
            {/* E-mail Institucional */}
            <div className="space-y-2">
              <Label
                htmlFor="email-input"
                className="text-xs font-semibold text-slate-700"
              >
                E-mail institucional
              </Label>
              <Input
                id="email-input"
                data-testid="input-login-email"
                type="email"
                autoComplete="email"
                placeholder="Digite seu e-mail"
                className="h-11 rounded-xl bg-white border-slate-200 text-sm shadow-2xs focus-visible:border-[#146C5C] focus-visible:ring-[#146C5C]/15"
                {...register('email', {
                  onChange: () => authError && setAuthError(null),
                })}
              />
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password-input"
                  className="text-xs font-semibold text-slate-700"
                >
                  Senha
                </Label>
                <button
                  type="button"
                  data-testid="btn-forgot-password"
                  onClick={() => {
                    setForgotStep('request');
                    setRecoveryFeedback(null);
                    forgotForm.reset();
                    resetForm.reset();
                    setForgotOpen(true);
                  }}
                  className="text-xs text-[#146C5C] hover:text-[#0F5347] font-semibold hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password-input"
                  data-testid="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  className="h-11 pr-10 rounded-xl bg-white border-slate-200 text-sm shadow-2xs focus-visible:border-[#146C5C] focus-visible:ring-[#146C5C]/15"
                  {...register('password', {
                    onChange: () => authError && setAuthError(null),
                  })}
                />
                <button
                  type="button"
                  data-testid="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {formErrorMessage && (
              <div
                data-testid="login-error-alert"
                role="alert"
                className="rounded-xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-xs text-rose-600 font-medium"
              >
                {formErrorMessage}
              </div>
            )}

            <Button
              type="submit"
              data-testid="btn-login-submit"
              disabled={isSubmitting}
              className="w-full bg-[#146C5C] hover:bg-[#0F5347] text-white font-semibold h-11 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Entrar no sistema'
              )}
            </Button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            Problemas com o acesso? Procure o suporte de TI do departamento.
          </p>
        </div>
      </main>

      {/* Forgot Password Flow Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <KeyRound className="h-5 w-5 text-[#146C5C]" />
              Recuperação de Senha
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Fluxo institucional com validação de token por e-mail
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 'request' && (
            <form
              onSubmit={forgotForm.handleSubmit(handleForgotSubmit)}
              className="space-y-4 py-2"
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="rec-email"
                  className="text-xs font-semibold text-slate-700"
                >
                  Informe seu e-mail institucional UTFPR
                </Label>
                <Input
                  id="rec-email"
                  type="text"
                  placeholder="usuario@utfpr.edu.br"
                  {...forgotForm.register('email')}
                />
                {forgotForm.formState.errors.email && (
                  <p className="text-xs text-red-500">
                    {forgotForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={forgotForm.formState.isSubmitting}
                  className="bg-[#146C5C] hover:bg-[#0F5347] text-white"
                >
                  {forgotForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enviar Token de Redefinição'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === 'reset' && (
            <form
              onSubmit={resetForm.handleSubmit(handleResetSubmit)}
              className="space-y-4 py-2"
            >
              <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 border border-emerald-200">
                {recoveryFeedback ||
                  `Token de 6 dígitos enviado para ${recoveryEmail}`}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="token-input"
                  className="text-xs font-semibold text-slate-700"
                >
                  Token Recebido por E-mail (ex: 849201)
                </Label>
                <Input
                  id="token-input"
                  placeholder="Digite o código ou token"
                  {...resetForm.register('token')}
                />
                {resetForm.formState.errors.token && (
                  <p className="text-xs text-red-500">
                    {resetForm.formState.errors.token.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-pass-input"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nova Senha
                </Label>
                <Input
                  id="new-pass-input"
                  type="password"
                  placeholder="••••••••"
                  {...resetForm.register('newPassword')}
                />
                {resetForm.formState.errors.newPassword && (
                  <p className="text-xs text-red-500">
                    {resetForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotStep('request')}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={resetForm.formState.isSubmitting}
                  className="bg-[#146C5C] hover:bg-[#0F5347] text-white"
                >
                  {resetForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Salvar Nova Senha'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === 'success' && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900">
                Senha Alterada com Sucesso!
              </h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Sua credencial foi atualizada. Você já pode efetuar o login
                utilizando a nova senha cadastrada.
              </p>
              <Button
                onClick={() => setForgotOpen(false)}
                className="mt-3 bg-[#146C5C] hover:bg-[#0F5347] text-white"
              >
                Retornar ao Login
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
