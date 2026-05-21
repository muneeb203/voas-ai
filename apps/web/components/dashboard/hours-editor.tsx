'use client';

import { useState } from 'react';
import type { LocationHours } from '@/lib/types';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const DEFAULT_OPEN = { open: '09:00', close: '21:00' };

interface HoursEditorProps {
  defaultValue?: LocationHours | null;
  name?: string;
}

/**
 * Renders a 7-row grid editor. The serialized JSON is in a hidden
 * input named `hours_json` so the form action reads it cleanly.
 */
export function HoursEditor({ defaultValue, name = 'hours_json' }: HoursEditorProps) {
  const [state, setState] = useState<LocationHours>(() => {
    const initial: LocationHours = {};
    for (const d of DAYS) {
      initial[d.key] = defaultValue?.[d.key] ?? DEFAULT_OPEN;
    }
    return initial;
  });

  function setDay(key: string, value: { open: string; close: string } | null) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <input type="hidden" name={name} value={JSON.stringify(state)} />

      <div className="space-y-2">
        {DAYS.map((d) => {
          const value = state[d.key];
          const closed = value === null;
          return (
            <div
              key={d.key}
              className="grid grid-cols-[60px_80px_1fr_1fr] items-center gap-3"
            >
              <span className="text-sm font-medium">{d.label}</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={!closed}
                  onChange={(e) =>
                    setDay(d.key, e.target.checked ? DEFAULT_OPEN : null)
                  }
                />
                Open
              </label>

              <input
                type="time"
                value={value?.open ?? ''}
                onChange={(e) =>
                  !closed && setDay(d.key, { ...value!, open: e.target.value })
                }
                disabled={closed}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"
              />
              <input
                type="time"
                value={value?.close ?? ''}
                onChange={(e) =>
                  !closed && setDay(d.key, { ...value!, close: e.target.value })
                }
                disabled={closed}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
