import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: number; label: string };
  icon?: React.ComponentType<{ className?: string }>;
}

export function StatCard({ label, value, subtext, trend, icon: Icon }: StatCardProps) {
  const trendUp = trend ? trend.value >= 0 : false;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Icon className="h-4 w-4 text-accent" />
            </div>
          )}
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                trendUp ? 'text-success' : 'text-error',
              )}
            >
              {trendUp ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}% {trend.label}
            </span>
          )}
          {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
