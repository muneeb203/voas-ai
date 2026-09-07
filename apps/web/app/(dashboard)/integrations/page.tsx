import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, MessageSquare, AlertCircle, QrCode, MonitorSmartphone } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getVoiceCapabilities, getVoiceSettings } from '@/lib/api/voice';
import { getWhatsAppCapabilities, getWhatsAppSettings, getLocationWhatsAppConfig } from '@/lib/api/whatsapp';
import { listLocations } from '@/lib/api/locations';
import { listKioskTokens, getKioskSettings } from '@/lib/api/kiosk';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';

export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsPage() {
  const session = await requireDashboardSession('/integrations');

  const workspaceId = session.active.workspace_id;

  const [settingsRes, capsRes, waSettingsRes, waCapsRes, locationsRes, kioskTokensRes, kioskSettingsRes] =
    await Promise.all([
      getVoiceSettings(workspaceId),
      getVoiceCapabilities(),
      getWhatsAppSettings(workspaceId),
      getWhatsAppCapabilities(),
      listLocations(workspaceId),
      listKioskTokens(workspaceId),
      getKioskSettings(workspaceId),
    ]);

  const settings = !isApiError(settingsRes) ? settingsRes.data : null;
  const caps = !isApiError(capsRes) ? capsRes.data : null;
  const waSettings = !isApiError(waSettingsRes) ? waSettingsRes.data : null;
  const waCaps = !isApiError(waCapsRes) ? waCapsRes.data : null;
  const locations = !isApiError(locationsRes) ? locationsRes.data : [];
  const kioskTokens = !isApiError(kioskTokensRes) ? kioskTokensRes.data : [];
  const kioskSettings = !isApiError(kioskSettingsRes) ? kioskSettingsRes.data : null;
  // In-Store is "set up" once at least one location has a live kiosk URL.
  const hasKioskUrl = kioskTokens.some((t) => t.is_active);
  // QR is "set up" once an admin has switched phone ordering on.
  const phoneOrderingOn = Boolean(kioskSettings?.phone_ordering_enabled);

  const waConfigResults = await Promise.all(
    locations.map((loc) => getLocationWhatsAppConfig(workspaceId, loc.id)),
  );
  const waLocationConfigs = waConfigResults.flatMap((r) =>
    isApiError(r) || r.data === null ? [] : [r.data],
  );
  const hasLiveWhatsAppLocation = waLocationConfigs.some((c) => c.enabled);

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Integrations"
        description="Connect your phone, messaging, payments, and POS so the AI agent works end-to-end."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VoiceCard
          assistantId={settings?.vapi_assistant_id ?? null}
          enabled={settings?.enabled ?? false}
          vapiConfigured={caps?.vapi_configured ?? false}
        />
        <InStoreCard setUp={hasKioskUrl} />
        <QrOrderingCard setUp={phoneOrderingOn} />
        <WhatsAppCard
          enabled={waSettings?.enabled ?? false}
          hasLocationConfig={waLocationConfigs.length > 0}
          hasLiveLocation={hasLiveWhatsAppLocation}
          openaiConfigured={waCaps?.openai_configured ?? false}
        />
      </div>
    </div>
  );
}

// Consistent CTA across every integration card: a solid (blue/brand) "Set up
// now" when the feature isn't configured, a plain outline "Manage" once it is.
function SetupButton({ setUp, href }: { setUp: boolean; href: string }) {
  return (
    <Button asChild variant={setUp ? 'outline' : 'default'} className="w-full">
      <Link href={href}>{setUp ? 'Manage' : 'Set up now'}</Link>
    </Button>
  );
}

function InStoreCard({ setUp }: { setUp: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <MonitorSmartphone className="h-5 w-5 text-accent" />
          </div>
          {!setUp && <Badge variant="secondary">Not set up</Badge>}
        </div>
        <div>
          <h3 className="text-base font-semibold">In-Store Ordering</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn any tablet at the counter into a self-service kiosk — voice or tap. Generate a
            kiosk URL per location and set the theme and tone.
          </p>
        </div>
        <SetupButton setUp={setUp} href="/self-order" />
      </CardContent>
    </Card>
  );
}

function QrOrderingCard({ setUp }: { setUp: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <QrCode className="h-5 w-5 text-accent" />
          </div>
          <div className="flex items-center gap-1.5">
            {!setUp && <Badge variant="secondary">Not set up</Badge>}
            <Badge variant="accent" className="px-1.5 py-0 text-[10px] uppercase tracking-wide">
              Beta
            </Badge>
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold">QR Ordering</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Print a QR code per location. Customers scan and order from their own phone; they pick
            up by order number.
          </p>
        </div>
        <SetupButton setUp={setUp} href="/integrations/qr" />
      </CardContent>
    </Card>
  );
}

function VoiceCard({
  assistantId,
  enabled,
  vapiConfigured,
}: {
  assistantId: string | null;
  enabled: boolean;
  vapiConfigured: boolean;
}) {
  const status = enabled && assistantId
    ? { label: 'Live', variant: 'success' as const }
    : assistantId
      ? { label: 'Configured · disabled', variant: 'warning' as const }
      : { label: 'Not configured', variant: 'secondary' as const };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Phone className="h-5 w-5 text-accent" />
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div>
          <h3 className="text-base font-semibold">Voice</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            AI answers your phone via Vapi + Twilio. Configure your agent's prompt + assign a
            phone number per location.
          </p>
        </div>

        {!vapiConfigured && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
            <p>
              Vapi keys aren't set in the backend. You can still edit settings here — they'll
              activate when an admin adds <code className="font-mono">VAPI_API_KEY</code> to
              the API env.
            </p>
          </div>
        )}

        <SetupButton setUp={Boolean(assistantId)} href="/integrations/voice" />
      </CardContent>
    </Card>
  );
}

function WhatsAppCard({
  enabled,
  hasLocationConfig,
  hasLiveLocation,
  openaiConfigured,
}: {
  enabled: boolean;
  hasLocationConfig: boolean;
  hasLiveLocation: boolean;
  openaiConfigured: boolean;
}) {
  const status =
    enabled && hasLiveLocation
      ? { label: 'Live', variant: 'success' as const }
      : hasLocationConfig
        ? { label: 'Configured · disabled', variant: 'warning' as const }
        : { label: 'Not configured', variant: 'secondary' as const };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold">WhatsApp</h3>
            <Badge variant="accent" className="px-1.5 py-0 text-[10px] uppercase tracking-wide">
              Beta
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI answers WhatsApp messages via Twilio. Configure your agent and assign a WhatsApp
            number per location.
          </p>
        </div>

        {!openaiConfigured && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
            <p>
              OpenAI isn&apos;t set in the backend. Add <code className="font-mono">OPENAI_API_KEY</code>{' '}
              to the API env for real replies.
            </p>
          </div>
        )}

        <SetupButton setUp={hasLocationConfig} href="/integrations/whatsapp" />
      </CardContent>
    </Card>
  );
}

