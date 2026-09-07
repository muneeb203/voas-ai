import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listLocations } from '@/lib/api/locations';
import { listKioskTokens, getKioskSettings } from '@/lib/api/kiosk';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { PhoneOrderQrPanel } from '@/components/dashboard/phone-order-qr-panel';

export const metadata: Metadata = { title: 'QR Ordering' };

export default async function QrOrderingPage() {
  const session = await requireDashboardSession('/integrations/qr');
  const workspaceId = session.active.workspace_id;
  const isOwner = session.active.role === 'owner';

  const [locationsRes, tokensRes, settingsRes] = await Promise.all([
    listLocations(workspaceId),
    listKioskTokens(workspaceId),
    getKioskSettings(workspaceId),
  ]);

  const locations = !isApiError(locationsRes) ? locationsRes.data : [];
  const tokens = !isApiError(tokensRes) ? tokensRes.data : [];
  const settings = !isApiError(settingsRes) ? settingsRes.data : null;
  const enabled = Boolean(settings?.phone_ordering_enabled);

  const activeTokenByLocation = new Map(
    tokens.filter((t) => t.is_active).map((t) => [t.location_id, t.token]),
  );

  const locationQrs = locations.map((loc) => ({
    locationId: loc.id,
    locationName: loc.name,
    token: activeTokenByLocation.get(loc.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="QR Ordering"
        description="Print a QR code for each location. Customers scan it and order from their own phone — no app, no waiting. Orders pick up by number."
      />
      <PhoneOrderQrPanel
        enabled={enabled}
        locations={locationQrs}
        lockEnabled={Boolean(settings?.phone_order_lock_enabled)}
        lockMinutes={settings?.phone_order_lock_minutes ?? 30}
        isOwner={isOwner}
      />
    </div>
  );
}
