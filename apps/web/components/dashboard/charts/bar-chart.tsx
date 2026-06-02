'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
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
  const [hovered, setHovered] = useState<number | null>(null);

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
  // Show a sparse set of x-axis labels: first, last, and roughly every 7th.
  const labelStep = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / maxValue) * 100;
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex flex-1 items-end"
              style={{ height: '100%' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={cn('w-full rounded-t-sm transition-opacity', color, {
                  'opacity-100': hovered === i || hovered === null,
                  'opacity-40': hovered !== null && hovered !== i,
                })}
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0 }}
              />
              {hovered === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md">
                  <span className="font-medium text-foreground">{d.label}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {formatValue(d.value)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d, i) =>
          i % labelStep === 0 || i === data.length - 1 ? (
            <span key={`lbl-${i}`} className="flex-1 truncate text-center first:text-left last:text-right">
              {d.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
