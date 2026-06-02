'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

interface DaysSelectorProps {
  selected: number;
}

export function DaysSelector({ selected }: DaysSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1">
      {OPTIONS.map((opt) => (
        <Link
          key={opt.days}
          href={`/analytics?days=${opt.days}`}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            selected === opt.days
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
