import { cn } from '@/lib/utils';

interface HorizontalBarItem {
  label: string;
  value: number;
  subLabel?: string;
}

interface HorizontalBarProps {
  items: HorizontalBarItem[];
  maxValue?: number;
  color?: string;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
}

export function HorizontalBar({
  items,
  maxValue,
  color = 'bg-accent',
  formatValue = (v) => String(v),
  emptyMessage = 'No data in this period',
}: HorizontalBarProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <div key={`${item.label}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{item.label}</span>
              <span className="flex-shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatValue(item.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', color)}
                style={{ width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%` }}
              />
            </div>
            {item.subLabel && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.subLabel}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
