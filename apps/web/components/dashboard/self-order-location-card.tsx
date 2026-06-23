'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, RefreshCw, Trash2, MonitorSmartphone, Lock, ArrowUpRight } from 'lucide-react';
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
  kioskEnabled: boolean;
  canGenerate: boolean;
  maxKioskUrls: number;
}

export function SelfOrderLocationCard({
  location,
  token,
  isOwner,
  kioskEnabled,
  canGenerate,
  maxKioskUrls,
}: SelfOrderLocationCardProps) {
  const [pending, setPending] = useState<'generate' | 'revoke' | null>(null);
  const [copied, setCopied] = useState(false);

  const kioskUrl =
    token?.is_active && kioskEnabled
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

  const isDisabledByLimit = token && !token.is_active;
  const hasActiveToken = token?.is_active === true;
  const atLimit = kioskEnabled && !canGenerate && !hasActiveToken;

  function renderBadge() {
    if (!kioskEnabled) return <Badge variant="secondary">Not available</Badge>;
    if (hasActiveToken) return <Badge variant="success">Active</Badge>;
    if (isDisabledByLimit) return <Badge variant="warning">Paused</Badge>;
    return <Badge variant="secondary">No kiosk URL</Badge>;
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
                {location.city
                  ? `${location.city}${location.state ? `, ${location.state}` : ''}`
                  : 'No address'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">{renderBadge()}</div>
        </div>

        {/* Kiosk not enabled on this plan */}
        {!kioskEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-3">
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                Self-order kiosk is not included in your current plan.
              </p>
              <a
                href="/support"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Contact us to get access <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Over limit — this location's URL was paused */}
        {kioskEnabled && isDisabledByLimit && (
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-3">
            <p className="text-xs text-warning">
              This location&apos;s kiosk was paused because your plan allows a maximum of{' '}
              <strong>{maxKioskUrls}</strong> active kiosk URL{maxKioskUrls !== 1 ? 's' : ''}.
              Revoke another location to reactivate this one, or contact us to increase your limit.
            </p>
            <a
              href="/support"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Request more kiosk URLs <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Active URL display */}
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

        {/* Action buttons */}
        {isOwner && kioskEnabled && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={pending !== null || !canGenerate}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${pending === 'generate' ? 'animate-spin' : ''}`}
                />
                {hasActiveToken ? 'Regenerate URL' : 'Generate URL'}
              </Button>

              {token && (
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

            {/* At limit — no token for this location */}
            {atLimit && (
              <p className="text-xs text-muted-foreground">
                You&apos;ve reached your limit of <strong>{maxKioskUrls}</strong> active kiosk
                URL{maxKioskUrls !== 1 ? 's' : ''}.{' '}
                <a href="/support" className="font-medium text-accent hover:underline">
                  Contact us to add more.
                </a>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
