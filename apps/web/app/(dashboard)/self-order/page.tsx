import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listLocations } from '@/lib/api/locations';
import { listKioskTokens, getKioskSettings } from '@/lib/api/kiosk';
import { getBillingUsage } from '@/lib/api/billing';
import { isApiError } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { SelfOrderLocationCard } from '@/components/dashboard/self-order-location-card';
import { KioskSettingsCard } from '@/components/dashboard/kiosk-settings-card';

export const metadata: Metadata = { title: 'Self Order' };

export default async function SelfOrderPage() {
  const session = await requireDashboardSession('/self-order');
  const isOwner = session.active.role === 'owner';
  const workspaceId = session.active.workspace_id;

  const [locationsRes, tokensRes, billingRes, settingsRes] = await Promise.all([
    listLocations(workspaceId),
    listKioskTokens(workspaceId),
    getBillingUsage(workspaceId),
    getKioskSettings(workspaceId),
  ]);

  const locations = !isApiError(locationsRes) ? locationsRes.data : [];
  const tokens = !isApiError(tokensRes) ? tokensRes.data : [];
  const billing = !isApiError(billingRes) ? billingRes.data : null;
  const kioskSettings = !isApiError(settingsRes)
    ? settingsRes.data
    : { theme: 'gradient' as const, session_lock_enabled: false };

  const tokenByLocation = Object.fromEntries(tokens.map((t) => [t.location_id, t]));

  const minutesUsed = billing?.voice_minutes.used ?? 0;
  const minutesLimit = billing?.voice_minutes.plan_limit ?? 0;
  const minutesPct = billing?.voice_minutes.percent_used ?? 0;
  const hasActiveKiosk = tokens.some((t) => t.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="In-Store"
        title="Self Order"
        description="Give every location a kiosk URL — customers walk up, speak their order, and the AI handles the rest."
      />

      {hasActiveKiosk && billing && minutesPct >= 50 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Voice minutes notice</p>
            <p className="mt-0.5 text-muted-foreground">
              You have used <strong>{minutesUsed}</strong> of <strong>{minutesLimit}</strong> voice
              minutes this period ({minutesPct}%). Each kiosk order uses 1–3 minutes. Contact us to
              top up before you run out.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Generate a unique URL for each location. Open it on any tablet or screen at the
            counter. Customers tap and speak — the AI takes their order. You can revoke or
            regenerate the URL at any time if security is a concern.
          </CardDescription>
        </CardHeader>
      </Card>

      {isOwner && <KioskSettingsCard initialSettings={kioskSettings} />}

      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No locations yet.{' '}
              <a href="/locations" className="underline hover:text-foreground">
                Add a location
              </a>{' '}
              first, then come back to generate a kiosk URL.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {locations.map((loc) => (
            <SelfOrderLocationCard
              key={loc.id}
              location={loc}
              token={tokenByLocation[loc.id] ?? null}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
