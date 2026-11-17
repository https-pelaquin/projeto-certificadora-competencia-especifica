import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <div
      data-testid="requests-cards-skeleton"
      className={cn(
        'grid gap-4',
        count === 2
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-36 bg-slate-200/70" />
            <Skeleton className="h-8 w-8 rounded-lg bg-slate-100" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-44 bg-slate-200/80" />
            <Skeleton className="h-3 w-28 bg-slate-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
