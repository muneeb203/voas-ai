'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  generateKioskTone,
  TONE_STYLE_LABELS,
  RESTAURANT_HANDOVER_LABELS,
  SALON_HANDOVER_LABELS,
  type KioskLanguage,
  type KioskToneStyle,
  type RestaurantHandover,
  type SalonHandover,
} from '@/lib/kiosk-tone-templates';

const LANGUAGES: { id: KioskLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ur', label: 'اردو' },
  { id: 'ar', label: 'العربية' },
];

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="flex overflow-hidden rounded-md border border-input">
        {options.map((o, i) => (
          <div key={o.id} className="flex flex-1">
            {i > 0 && <div className="w-px bg-input" />}
            <button
              type="button"
              onClick={() => onChange(o.id)}
              className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                value === o.id
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {o.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface KioskToneGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSalon: boolean;
  onApply: (result: { tone: string; handover: string }) => void;
}

export function KioskToneGeneratorModal({
  open,
  onOpenChange,
  isSalon,
  onApply,
}: KioskToneGeneratorModalProps) {
  const [language, setLanguage] = useState<KioskLanguage>('en');
  const [toneStyle, setToneStyle] = useState<KioskToneStyle>('friendly');
  const [restaurantHandover, setRestaurantHandover] = useState<RestaurantHandover>('counter');
  const [salonHandover, setSalonHandover] = useState<SalonHandover>('reception');

  const preview = generateKioskTone({
    language,
    toneStyle,
    vertical: isSalon ? 'salon' : 'restaurant',
    handover: isSalon ? salonHandover : restaurantHandover,
    greetLocally: language !== 'en',
  });

  const rtl = language !== 'en';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Auto-generate kiosk wording
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Choice
            label="Language"
            options={LANGUAGES}
            value={language}
            onChange={setLanguage}
          />

          <Choice
            label="Tone"
            options={[
              { id: 'formal' as const, label: TONE_STYLE_LABELS[language].formal },
              { id: 'friendly' as const, label: TONE_STYLE_LABELS[language].friendly },
            ]}
            value={toneStyle}
            onChange={setToneStyle}
          />

          {isSalon ? (
            <Choice
              label="After booking"
              options={[
                { id: 'reception' as const, label: SALON_HANDOVER_LABELS.reception },
                { id: 'called' as const, label: SALON_HANDOVER_LABELS.called },
              ]}
              value={salonHandover}
              onChange={setSalonHandover}
            />
          ) : (
            <Choice
              label="Order handover"
              options={[
                { id: 'counter' as const, label: RESTAURANT_HANDOVER_LABELS.counter },
                { id: 'table' as const, label: RESTAURANT_HANDOVER_LABELS.table },
              ]}
              value={restaurantHandover}
              onChange={setRestaurantHandover}
            />
          )}

          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <div className="space-y-2" dir={rtl ? 'rtl' : 'ltr'}>
              <p className="text-sm">{preview.tone}</p>
              <p className="text-sm text-muted-foreground">{preview.handover}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This fills both fields — you can edit them afterwards.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(preview);
              onOpenChange(false);
            }}
          >
            Use this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
