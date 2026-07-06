'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminKioskMetrics, KioskMetricsWindow } from '@/lib/api/admin';

interface AdminKioskMetricsCardProps {
  metrics: AdminKioskMetrics;
}

type WindowKey = '7d' | '30d' | 'all';

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminKioskMetricsCard({ metrics }: AdminKioskMetricsCardProps) {
  const [win, setWin] = useState<WindowKey>('7d');

  const data: KioskMetricsWindow =
    win === '7d' ? metrics.window_7d : win === '30d' ? metrics.window_30d : metrics.window_all;

  const confidence =
    data.avg_confidence != null ? `${Math.round(data.avg_confidence * 100)}%` : '—';
  const chat = data.avg_chat_ms != null ? `${data.avg_chat_ms}ms` : '—';
  const tts = data.avg_tts_ms != null ? `${data.avg_tts_ms}ms` : '—';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Kiosk Performance</CardTitle>
            <CardDescription>
              Speech accuracy proxy (Deepgram confidence), provider latency, and orders placed.
            </CardDescription>
          </div>
          <div className="inline-flex rounded-lg border p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setWin(w.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  win === w.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.total_turns === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No kiosk activity in this period yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="STT confidence"
              value={confidence}
              hint={
                data.deepgram_turns > 0
                  ? `avg over ${data.deepgram_turns.toLocaleString()} Deepgram turn${data.deepgram_turns !== 1 ? 's' : ''}`
                  : 'no Deepgram turns'
              }
            />
            <Stat
              label="Deepgram usage"
              value={pct(data.deepgram_turns, data.total_turns)}
              hint={`${data.deepgram_turns.toLocaleString()} of ${data.total_turns.toLocaleString()} turns`}
            />
            <Stat label="Orders placed" value={data.orders_placed.toLocaleString()} />
            <Stat label="Avg chat latency" value={chat} hint="Claude response" />
            <Stat label="Avg TTS latency" value={tts} hint="OpenAI first audio" />
            <Stat label="Total turns" value={data.total_turns.toLocaleString()} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
