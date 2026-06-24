'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateKioskSettingsAction } from '@/app/actions/kiosk-action';
import type { KioskSettings } from '@/lib/api/kiosk';

interface KioskSettingsCardProps {
  initialSettings: KioskSettings;
}

type Theme = KioskSettings['theme'];

const THEMES: { id: Theme; label: string; description: string; preview: React.ReactNode }[] = [
  {
    id: 'warm',
    label: 'Warm Charcoal',
    description: 'Dark warm background with amber accents. Great for cafes and casual dining.',
    preview: (
      <div
        className="flex h-16 w-full items-center justify-center rounded-lg"
        style={{ background: 'linear-gradient(135deg, #1a1208 0%, #2d1f0e 100%)' }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-amber-500/40">
          <span className="text-xs text-white">●</span>
        </div>
      </div>
    ),
  },
  {
    id: 'light',
    label: 'Clean Light',
    description: 'White background with navy header. High contrast — great in bright lighting.',
    preview: (
      <div className="flex h-16 w-full flex-col overflow-hidden rounded-lg border border-border">
        <div className="flex h-6 items-center justify-center bg-[#0A2540]">
          <span className="text-[8px] font-bold text-white">YOUR RESTAURANT</span>
        </div>
        <div className="flex flex-1 items-center justify-center bg-white">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2A8]">
            <span className="text-xs text-white">●</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'gradient',
    label: 'Bold Gradient',
    description: 'Deep navy-to-teal gradient. Sleek and modern.',
    preview: (
      <div
        className="flex h-16 w-full items-center justify-center rounded-lg"
        style={{ background: 'linear-gradient(145deg, #0A2540 0%, #0d3260 40%, #0a4a4a 100%)' }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2A8] shadow-lg shadow-[#00C2A8]/40">
          <span className="text-xs text-white">●</span>
        </div>
      </div>
    ),
  },
];

export function KioskSettingsCard({ initialSettings }: KioskSettingsCardProps) {
  const [theme, setTheme] = useState<Theme>(initialSettings.theme);
  const [saving, setSaving] = useState(false);

  const isDirty = theme !== initialSettings.theme;

  const used = initialSettings.kiosk_credits_used_this_month;
  const limit = initialSettings.kiosk_monthly_limit;
  const balance = initialSettings.kiosk_credits_balance;
  const isUnlimited = limit === 0;
  const isAtLimit = !isUnlimited && balance <= 0;
  const isNearLimit = !isUnlimited && limit > 0 && used >= limit * 0.8 && !isAtLimit;
  const usagePct = !isUnlimited && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  async function handleSave() {
    setSaving(true);
    const res = await updateKioskSettingsAction({ theme });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else toast.success('Kiosk settings saved');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiosk Appearance &amp; Security</CardTitle>
        <CardDescription>
          Choose a theme for your customer-facing kiosk screen and configure security options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monthly usage */}
        {!isUnlimited && limit > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Kiosk interactions this month</p>
              <span className="text-sm tabular-nums text-muted-foreground">
                {used.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isAtLimit
                    ? 'bg-destructive'
                    : isNearLimit
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {isAtLimit && (
              <p className="text-xs font-medium text-destructive">
                Monthly interaction limit reached. Kiosk is temporarily unavailable until your
                credits are replenished. Contact support to add more.
              </p>
            )}
            {isNearLimit && (
              <p className="text-xs text-amber-600">
                You&apos;ve used {usagePct}% of your monthly kiosk interactions. Contact support to
                add more credits before your limit is reached.
              </p>
            )}
            {!isAtLimit && !isNearLimit && (
              <p className="text-xs text-muted-foreground">
                Credits roll over — unused interactions accumulate indefinitely.
              </p>
            )}
          </div>
        )}

        {/* Theme picker */}
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Screen theme</p>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  theme === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                {t.preview}
                <p className="mt-2 text-xs font-semibold text-foreground">{t.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
