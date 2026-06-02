import { cn } from '@/lib/utils';

interface BarChartProps {
  data: Array<{ label: string; value: number; formattedValue?: string }>;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
}

export function BarChart({
  data,
  height = 120,
  color = 'bg-accent',
  formatValue = (v) => String(v),
  emptyMessage = 'No data in this period',
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const labelStep = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / maxValue) * 100;
          const displayValue = d.formattedValue ?? formatValue(d.value);
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex flex-1 items-end"
              style={{ height: '100%' }}
            >
              <div
                className={cn(
                  'w-full rounded-t-sm transition-opacity group-hover:opacity-100',
                  color,
                  'opacity-70',
                )}
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="ml-1.5 text-muted-foreground">{displayValue}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d, i) =>
          i % labelStep === 0 || i === data.length - 1 ? (
            <span
              key={`lbl-${i}`}
              className="flex-1 truncate text-center first:text-left last:text-right"
            >
              {d.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
