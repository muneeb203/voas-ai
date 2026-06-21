'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldHelpProps {
  title: string;
  steps: string[];
  className?: string;
}

export function FieldHelp({ title, steps, className }: FieldHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide help' : `Help: ${title}`}
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-muted-foreground/40 text-muted-foreground hover:border-accent hover:text-accent',
        )}
      >
        ?
      </button>

      {open && (
        <div
          role="region"
          aria-label={title}
          className="absolute left-0 top-6 z-50 w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="mt-px text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-xs text-muted-foreground">
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </span>
  );
}
