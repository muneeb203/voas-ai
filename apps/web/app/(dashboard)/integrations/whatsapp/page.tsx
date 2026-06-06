import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, MessageSquare } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  getWhatsAppCapabilities,
  getWhatsAppSettings,
  getLocationWhatsAppConfig,
} from '@/lib/api/whatsapp';
import { listLocations } from '@/lib/api/locations';
import { isApiError, type LocationWhatsAppConfigSafe } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { WhatsAppSettingsForm } from '@/components/dashboard/whatsapp-settings-form';
import { LocationWhatsAppCard } from '@/components/dashboard/location-whatsapp-card';

export const metadata: Metadata = { title: 'WhatsApp settings' };

export default async function WhatsAppSettingsPage() {
  const session = await requireDashboardSession('/integrations/whatsapp');
  const isOwner = session.active.role === 'owner';
  const workspaceId = session.active.workspace_id;

  const [settingsRes, capsRes, locationsRes] = await Promise.all([
    getWhatsAppSettings(workspaceId),
    getWhatsAppCapabilities(),
    listLocations(workspaceId),
  ]);

  if (isApiError(settingsRes)) {
    throw new Error(settingsRes.error.message);
  }
  if (isApiError(capsRes)) {
    throw new Error(capsRes.error.message);
  }
  const settings = settingsRes.data;
  const caps = capsRes.data;
  const locations = !isApiError(locationsRes) ? locationsRes.data : [];

  const configs = await Promise.all(
    locations.map((loc) => getLocationWhatsAppConfig(workspaceId, loc.id)),
  );
  const configByLocation: Record<string, LocationWhatsAppConfigSafe | null> = {};
  locations.forEach((loc, i) => {
    const r = configs[i];
    configByLocation[loc.id] = r && !isApiError(r) ? r.data : null;
  });

  return (
    <div className="space-y-6">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to integrations
      </Link>

      <PageHeader
        eyebrow="Integration"
        title="WhatsApp"
        description="Your AI agent answers WhatsApp messages via Twilio. Configure the agent here, then add a WhatsApp number per location."
      />

      {!caps.openai_configured && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div>
            <p className="font-medium">OpenAI key is not set in the backend.</p>
            <p className="mt-1 text-muted-foreground">
              You can edit settings here, but no real replies are generated until an admin adds{' '}
              <code className="font-mono text-xs">OPENAI_API_KEY</code> to the API env.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Agent personality</CardTitle>
            <CardDescription>
              Your menu is appended to the system prompt automatically. WhatsApp replies are kept
              short and free of formatting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppSettingsForm
              settings={settings}
              capabilities={caps}
              disabled={!isOwner}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-4 text-xs">
              <p className="font-medium text-foreground">How it works</p>
              <p className="text-muted-foreground">
                Customers message your Twilio WhatsApp number. We find or open a conversation,
                generate a reply with your agent, and send it back. Orders the agent confirms land
                in{' '}
                <Link href="/orders" className="underline">
                  Orders
                </Link>
                , same as voice.
              </p>
              <div className="pt-2">
                <p className="font-medium text-foreground">Sandbox number</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {caps.sandbox_number}
                </p>
              </div>
              {!caps.twilio_configured && (
                <p className="pt-2 text-muted-foreground">
                  No global Twilio fallback set — credentials are read per location from the config
                  below.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold">Phone numbers</h2>
        </div>
        {locations.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Add a location first from the{' '}
              <Link href="/locations" className="underline">
                Locations
              </Link>{' '}
              page, then assign a WhatsApp number here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {locations.map((loc) => (
              <LocationWhatsAppCard
                key={loc.id}
                locationId={loc.id}
                locationName={loc.name}
                existing={configByLocation[loc.id] ?? null}
                sandboxNumber={caps.sandbox_number}
                disabled={!isOwner}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
