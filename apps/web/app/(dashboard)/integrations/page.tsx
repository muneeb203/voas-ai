import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getVoiceCapabilities, getVoiceSettings } from '@/lib/api/voice';
import { getWhatsAppCapabilities, getWhatsAppSettings, getLocationWhatsAppConfig } from '@/lib/api/whatsapp';
import { listLocations } from '@/lib/api/locations';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';

export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsPage() {
  const session = await requireDashboardSession('/integrations');

  const workspaceId = session.active.workspace_id;

  const [settingsRes, capsRes, waSettingsRes, waCapsRes, locationsRes] = await Promise.all([
    getVoiceSettings(workspaceId),
    getVoiceCapabilities(),
    getWhatsAppSettings(workspaceId),
    getWhatsAppCapabilities(),
    listLocations(workspaceId),
  ]);

  const settings = !isApiError(settingsRes) ? settingsRes.data : null;
  const caps = !isApiError(capsRes) ? capsRes.data : null;
  const waSettings = !isApiError(waSettingsRes) ? waSettingsRes.data : null;
  const waCaps = !isApiError(waCapsRes) ? waCapsRes.data : null;
  const locations = !isApiError(locationsRes) ? locationsRes.data : [];

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

        <WhatsAppCard
          enabled={waSettings?.enabled ?? false}
          hasLocationConfig={waLocationConfigs.length > 0}
          hasLiveLocation={hasLiveWhatsAppLocation}
          openaiConfigured={waCaps?.openai_configured ?? false}
        />
        <MoreIntegrationsCard />
      </div>
    </div>
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

        <Button asChild variant={assistantId ? 'outline' : 'default'} className="w-full">
          <Link href="/integrations/voice">
            {assistantId ? 'Edit voice settings' : 'Configure voice'}
          </Link>
        </Button>
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
          <h3 className="text-base font-semibold">WhatsApp</h3>
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

        <Button asChild variant={hasLocationConfig ? 'outline' : 'default'} className="w-full">
          <Link href="/integrations/whatsapp">
            {hasLocationConfig ? 'Edit WhatsApp settings' : 'Configure WhatsApp'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MoreIntegrationsCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex h-full flex-col justify-center space-y-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="text-base font-semibold">More integrations on the way</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            POS, payments, and calendar bookings are next — so your orders, payments, and
            appointments flow end-to-end.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
