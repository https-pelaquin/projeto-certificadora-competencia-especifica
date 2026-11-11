import { FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div data-testid="empty-state" className={cn('flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl bg-white border border-dashed border-slate-200', className)}>
      <div className="rounded-2xl bg-slate-100 p-4 mb-4 text-slate-500 shadow-inner">
        {icon ?? <FolderOpen className="h-8 w-8" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

