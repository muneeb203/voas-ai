'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, RefreshCw, Trash2, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateKioskTokenAction, revokeKioskTokenAction } from '@/app/actions/kiosk-action';
import type { Location } from '@/lib/types';
import type { KioskToken } from '@/lib/api/kiosk';

interface SelfOrderLocationCardProps {
  location: Location;
  token: KioskToken | null;
  isOwner: boolean;
}

export function SelfOrderLocationCard({ location, token, isOwner }: SelfOrderLocationCardProps) {
  const [pending, setPending] = useState<'generate' | 'revoke' | null>(null);
  const [copied, setCopied] = useState(false);

  const kioskUrl = token?.is_active
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/kiosk/${token.token}`
    : null;

  async function handleGenerate() {
    setPending('generate');
    const res = await generateKioskTokenAction(location.id);
    setPending(null);
    if (res.error) toast.error(res.error);
    else toast.success('Kiosk URL generated');
  }

  async function handleRevoke() {
    if (!token) return;
    if (!confirm('Revoke this kiosk URL? Anyone using it will be disconnected.')) return;
    setPending('revoke');
    const res = await revokeKioskTokenAction(token.id);
    setPending(null);
    if (res.error) toast.error(res.error);
    else toast.success('Kiosk URL revoked');
  }

  async function handleCopy() {
    if (!kioskUrl) return;
    await navigator.clipboard.writeText(kioskUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <MonitorSmartphone className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-medium text-foreground">{location.name}</p>
              <p className="text-xs text-muted-foreground">
                {location.city ? `${location.city}${location.state ? `, ${location.state}` : ''}` : 'No address'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token?.is_active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="secondary">No kiosk URL</Badge>
            )}
          </div>
        </div>

        {kioskUrl && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
            <p className="flex-1 truncate font-mono text-xs text-muted-foreground">{kioskUrl}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <a
              href={kioskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open kiosk"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {isOwner && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={pending !== null}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending === 'generate' ? 'animate-spin' : ''}`} />
              {token?.is_active ? 'Regenerate URL' : 'Generate URL'}
            </Button>

            {token?.is_active && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevoke}
                disabled={pending !== null}
                className="text-error hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pending === 'revoke' ? 'Revoking…' : 'Revoke'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
