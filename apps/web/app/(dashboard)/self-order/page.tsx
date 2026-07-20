import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listLocations } from '@/lib/api/locations';
import { listKioskTokens, getKioskSettings } from '@/lib/api/kiosk';
import { getBillingUsage } from '@/lib/api/billing';
import { PAY_AS_YOU_GO } from '@/lib/constants';
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
    : { theme: 'gradient' as const, session_lock_enabled: false, kiosk_enabled: false, max_kiosk_urls: 1, kiosk_monthly_limit: 500, kiosk_credits_balance: 0, kiosk_credits_used_this_month: 0, kiosk_month_start: null, restaurant_tone: null, restaurant_handover: null, salon_tone: null, salon_handover: null };

  const tokenByLocation = Object.fromEntries(tokens.map((t) => [t.location_id, t]));

  // Kiosk is always available now — access is gated only by the credit balance.
  const kioskEnabled = true;
  const maxKioskUrls = kioskSettings.max_kiosk_urls;
  const activeCount = tokens.filter((t) => t.is_active).length;

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
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kiosk usage is billed at{' '}
            <span className="font-medium text-foreground">
              ${PAY_AS_YOU_GO.kioskPerInteraction.toFixed(2)} per interaction
            </span>{' '}
            (1 credit each), or included in your monthly plan.
          </p>
        </CardContent>
      </Card>

      {isOwner && (
        <KioskSettingsCard
          initialSettings={kioskSettings}
          vertical={session.active.workspace.vertical}
        />
      )}

      {kioskEnabled && (
        <p className="text-sm text-muted-foreground">
          {activeCount} of {maxKioskUrls} kiosk URL{maxKioskUrls !== 1 ? 's' : ''} active
        </p>
      )}

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
          {locations.map((loc) => {
            const token = tokenByLocation[loc.id] ?? null;
            const canGenerate = true;
            return (
              <SelfOrderLocationCard
                key={loc.id}
                location={loc}
                token={token}
                isOwner={isOwner}
                kioskEnabled={kioskEnabled}
                canGenerate={canGenerate}
                maxKioskUrls={maxKioskUrls}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
