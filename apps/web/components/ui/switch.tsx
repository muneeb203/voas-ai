'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Lightweight toggle built on a native checkbox (no Radix dependency). Because
 * it's a real checkbox it participates in `<form>` submission — when checked it
 * submits its value (`"on"` by default), matching the other form controls.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className="inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" ref={ref} {...props} />
      <span
        className={cn(
          'relative h-6 w-11 rounded-full bg-input transition-colors',
          'peer-checked:bg-accent',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          'after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:content-[""]',
          'peer-checked:after:translate-x-5',
          className,
        )}
      />
    </label>
  ),
);
Switch.displayName = 'Switch';
