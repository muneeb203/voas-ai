import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

/** Common building block: a row of N skeleton table rows. */
export function SkeletonRows({ count = 4, columns = 4 }: { count?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-1/3' : 'w-1/6')} />
          ))}
        </div>
      ))}
    </div>
  );
}
