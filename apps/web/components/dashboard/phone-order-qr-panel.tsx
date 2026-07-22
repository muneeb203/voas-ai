'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LocationQr {
  locationId: string;
  locationName: string;
  token: string | null; // active kiosk token, or null if none generated
}

interface PhoneOrderQrPanelProps {
  enabled: boolean;
  locations: LocationQr[];
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

export function PhoneOrderQrPanel({ enabled, locations }: PhoneOrderQrPanelProps) {
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
