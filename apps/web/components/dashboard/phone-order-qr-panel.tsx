'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateKioskSettingsAction } from '@/app/actions/kiosk-action';

interface LocationQr {
  locationId: string;
  locationName: string;
  token: string | null; // active kiosk token, or null if none generated
}

interface PhoneOrderQrPanelProps {
  enabled: boolean;
  locations: LocationQr[];
  lockEnabled: boolean;
  lockMinutes: number;
  isOwner: boolean;
}

const LOCK_DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

function DeviceLockControls({
  lockEnabled,
  lockMinutes,
}: {
  lockEnabled: boolean;
  lockMinutes: number;
}) {
  const [on, setOn] = useState(lockEnabled);
  const [minutes, setMinutes] = useState(lockMinutes);
  const [saving, setSaving] = useState(false);

  // Snap an unknown stored value to the nearest preset for the dropdown.
  const selected = LOCK_DURATIONS.some((d) => d.value === minutes) ? minutes : 30;

  async function save(next: { enabled?: boolean; minutes?: number }) {
    const newOn = next.enabled ?? on;
    const newMin = next.minutes ?? minutes;
    setOn(newOn);
    setMinutes(newMin);
    setSaving(true);
    const res = await updateKioskSettingsAction({
      phone_order_lock_enabled: newOn,
      phone_order_lock_minutes: newMin,
    });
    setSaving(false);
    if (res.error) {
      setOn(lockEnabled);
      setMinutes(lockMinutes);
      toast.error(res.error);
    } else {
      toast.success('Device lock updated');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Label htmlFor="device-lock" className="text-sm font-semibold">
                One order per device
              </Label>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              After a customer orders on their phone, lock that device from ordering again for a
              while. Curbs accidental double orders. (Soft lock — clearing the browser bypasses it.)
            </p>
          </div>
          <Switch
            id="device-lock"
            checked={on}
            onChange={(e) => save({ enabled: e.target.checked })}
            disabled={saving}
          />
        </div>

        {on && (
          <div className="flex items-center gap-3 border-t pt-3">
            <Label htmlFor="lock-duration" className="text-sm">
              Lock for
            </Label>
            <Select
              value={String(selected)}
              onValueChange={(v) => save({ minutes: Number(v) })}
              disabled={saving}
            >
              <SelectTrigger id="lock-duration" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCK_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QrForLocation({ name, url }: { name: string; url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function download() {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-sm font-semibold">{name}</p>
        <div ref={ref} className="rounded-lg bg-white p-3">
          <QRCodeCanvas value={url} size={180} marginSize={2} level="M" />
        </div>
        <p className="max-w-full break-all text-xs text-muted-foreground">{url}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={download}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PhoneOrderQrPanel({
  enabled,
  locations,
  lockEnabled,
  lockMinutes,
  isOwner,
}: PhoneOrderQrPanelProps) {
  // window.origin at render time — the public link customers scan.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Phone ordering isn&apos;t enabled yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            QR ordering lets customers scan a code and order from their own phone, picking up by
            order number. Contact us to switch it on for your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  const withToken = locations.filter((l) => l.token);
  const withoutToken = locations.filter((l) => !l.token);

  return (
    <div className="space-y-6">
      {isOwner && <DeviceLockControls lockEnabled={lockEnabled} lockMinutes={lockMinutes} />}

      {withToken.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withToken.map((l) => (
            <QrForLocation key={l.locationId} name={l.locationName} url={`${origin}/order/${l.token}`} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Generate a kiosk URL for a location first (on the Self Order page) — the QR uses the
            same link.
          </CardContent>
        </Card>
      )}

      {withoutToken.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No code yet for: {withoutToken.map((l) => l.locationName).join(', ')}. Generate a kiosk URL
          for these on the{' '}
          <a href="/self-order" className="underline hover:text-foreground">
            Self Order
          </a>{' '}
          page.
        </p>
      )}
    </div>
  );
}
