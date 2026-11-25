import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Eye, EyeOff, KeyRound, Loader2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/services/api';

const setPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1, 'Informe o token de convite ou redefinição.')
      .max(200, 'Token inválido.'),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      token: tokenFromUrl,
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SetPasswordFormValues) => {
    try {
      setSubmitError(null);
      await resetPassword(data.token, data.password);
      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Não foi possível definir a senha. Verifique se o token ainda é válido.',
      );
    }
  };

  return (
    <div
      data-testid="set-password-page"
      className="min-h-screen w-full flex items-center justify-center bg-[#F4F6F5] px-6 py-10"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/80 shadow-xs p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#0F3F36] flex items-center justify-center text-white">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Gestão de Recursos</p>
            <p className="text-xs text-slate-500">DACOM • UTFPR Cornélio Procópio</p>
          </div>
        </div>

        {success ? (
          <div data-testid="set-password-success" className="py-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Senha definida com sucesso!
              </h1>
              <p className="text-xs text-slate-500 mt-1.5">
                Sua conta institucional está pronta. Acesse o portal com seu e-mail e a nova senha.
              </p>
            </div>
            <Button
              data-testid="btn-go-login"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full h-11 bg-[#146C5C] hover:bg-[#0F5347] text-white font-semibold"
            >
              Ir para o Login
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#146C5C] mb-1">
                <KeyRound className="h-3.5 w-3.5" />
                Acesso Institucional
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Definir Senha
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Crie uma senha com pelo menos 8 caracteres para ativar seu acesso ou concluir a redefinição.
              </p>
            </div>

            <form
              data-testid="form-set-password"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {!tokenFromUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="set-pass-token" className="text-xs font-semibold text-slate-700">
                    Token do convite / redefinição
                  </Label>
                  <Input
                    id="set-pass-token"
                    data-testid="input-set-password-token"
                    placeholder="Cole o token recebido por e-mail"
                    className="h-11 bg-white"
                    {...register('token')}
                  />
                  {errors.token && (
                    <p className="text-xs text-red-500 font-medium">{errors.token.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="set-pass-new" className="text-xs font-semibold text-slate-700">
                  Nova senha (mínimo 8 caracteres)
                </Label>
                <div className="relative">
                  <Input
                    id="set-pass-new"
                    data-testid="input-set-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-11 pr-10 bg-white"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p data-testid="error-set-password" className="text-xs text-red-500 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="set-pass-confirm" className="text-xs font-semibold text-slate-700">
                  Confirmar nova senha
                </Label>
                <Input
                  id="set-pass-confirm"
                  data-testid="input-set-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="h-11 bg-white"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p data-testid="error-set-password-confirm" className="text-xs text-red-500 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {submitError && (
                <div
                  data-testid="set-password-error"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
                >
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                data-testid="btn-submit-set-password"
                disabled={isSubmitting}
                className="w-full h-11 bg-[#146C5C] hover:bg-[#0F5347] text-white font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Definir Senha'
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
