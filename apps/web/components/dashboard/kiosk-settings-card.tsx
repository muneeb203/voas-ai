'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KioskToneGeneratorModal } from '@/components/dashboard/kiosk-tone-generator-modal';
import { updateKioskSettingsAction } from '@/app/actions/kiosk-action';
import type { KioskSettings } from '@/lib/api/kiosk';

interface KioskSettingsCardProps {
  initialSettings: KioskSettings;
  vertical: string;
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

export function KioskSettingsCard({ initialSettings, vertical }: KioskSettingsCardProps) {
  const isSalon = vertical === 'salon';
  const toneKey = isSalon ? 'salon_tone' : 'restaurant_tone';
  const handoverKey = isSalon ? 'salon_handover' : 'restaurant_handover';

  const [theme, setTheme] = useState<Theme>(initialSettings.theme);
  const [tone, setTone] = useState(initialSettings[toneKey] ?? '');
  const [handover, setHandover] = useState(initialSettings[handoverKey] ?? '');
  const [saving, setSaving] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const isDirty =
    theme !== initialSettings.theme ||
    tone !== (initialSettings[toneKey] ?? '') ||
    handover !== (initialSettings[handoverKey] ?? '');

  const balance = initialSettings.kiosk_credits_balance;
  const outOfCredits = balance <= 0;

  async function handleSave() {
    setSaving(true);
    const res = await updateKioskSettingsAction({
      theme,
      [toneKey]: tone,
      [handoverKey]: handover,
    });
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
        {/* Kiosk credits */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Kiosk credits</p>
            <span
              className={`text-sm font-semibold tabular-nums ${
                outOfCredits ? 'text-destructive' : ''
              }`}
            >
              {balance.toLocaleString()} remaining
            </span>
          </div>
          {outOfCredits ? (
            <p className="mt-2 text-xs font-medium text-destructive">
              Out of credits — the kiosk is inactive until more are added. Contact support to add
              credits.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Each completed order uses 1 credit. Contact support to add more when you run low.
            </p>
          )}
        </div>

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

        {/* Owner-editable kiosk voice */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">How your kiosk speaks</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional. The kiosk always follows its ordering rules — this changes the wording
                and what customers are told, not how orders are placed.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setGeneratorOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-generate
            </Button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="kiosk-tone" className="text-sm font-medium">
              Tone
            </label>
            <Textarea
              id="kiosk-tone"
              rows={2}
              maxLength={1000}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. Warm and friendly. Greet customers in Urdu, then continue in English."
            />
            <p className="text-xs text-muted-foreground">
              How the kiosk should sound. Leave empty for the default neutral tone.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="kiosk-handover" className="text-sm font-medium">
              {isSalon ? 'What happens after booking' : 'How the order is handed over'}
            </label>
            <Textarea
              id="kiosk-handover"
              rows={2}
              maxLength={1000}
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              placeholder={
                isSalon
                  ? 'e.g. Take a seat in the waiting area, your stylist will call you.'
                  : 'e.g. Wait at the counter, we call your number when it is ready.'
              }
            />
            <p className="text-xs text-muted-foreground">
              {isSalon
                ? 'Told to the customer once their appointment is booked.'
                : 'Told to the customer once their order is placed — table service, counter pickup, etc.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </CardContent>

      <KioskToneGeneratorModal
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        isSalon={isSalon}
        onApply={({ tone: t, handover: h }) => {
          setTone(t);
          setHandover(h);
        }}
      />
    </Card>
  );
}
