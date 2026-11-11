import { useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  dismissToast,
  getToastsSnapshot,
  subscribeToasts,
} from '@/lib/toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const items = useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsSnapshot,
  );

  if (items.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
    >
      {items.map((item) => {
        const isError = item.variant === 'error';
        const isSuccess = item.variant === 'success';
        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            data-testid={
              isError
                ? 'toast-error'
                : isSuccess
                  ? 'toast-success'
                  : 'toast-info'
            }
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-sm transition-all',
              isError &&
                'bg-red-50/95 border-red-200 text-red-900',
              isSuccess &&
                'bg-emerald-50/95 border-emerald-200 text-emerald-950',
              !isError &&
                !isSuccess &&
                'bg-white/95 border-slate-200 text-slate-900',
            )}
          >
            {isError ? (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              {item.title && (
                <p className="text-xs font-bold leading-tight">{item.title}</p>
              )}
              <p className="text-xs mt-0.5 leading-snug break-words">
                {item.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Fechar notificação"
              className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

