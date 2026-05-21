import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Phone,
  MessageSquare,
  CreditCard,
  Calendar,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getVoiceCapabilities, getVoiceSettings } from '@/lib/api/voice';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';

export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsPage() {
  const session = await requireDashboardSession('/integrations');

  const [settingsRes, capsRes] = await Promise.all([
    getVoiceSettings(session.active.workspace_id),
    getVoiceCapabilities(),
  ]);

  const settings = !isApiError(settingsRes) ? settingsRes.data : null;
  const caps = !isApiError(capsRes) ? capsRes.data : null;

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

        <ComingSoonCard
          icon={MessageSquare}
          title="WhatsApp"
          description="Inbound + outbound WhatsApp via Twilio."
          arrivesIn="V2 Sprint 3"
        />
        <ComingSoonCard
          icon={ShoppingBag}
          title="Toast POS"
          description="OAuth + menu sync + two-way order push."
          arrivesIn="V2 Sprint 4"
        />
        <ComingSoonCard
          icon={ShoppingBag}
          title="Square POS"
          description="OAuth + menu sync + two-way order push."
          arrivesIn="V2 Sprint 4"
        />
        <ComingSoonCard
          icon={CreditCard}
          title="Stripe billing"
          description="Subscriptions + usage-based overages."
          arrivesIn="V2 Sprint 5"
        />
        <ComingSoonCard
          icon={Calendar}
          title="Google Calendar"
          description="Bookings for dental, salon, auto verticals."
          arrivesIn="V3"
        />
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

function ComingSoonCard({
  icon: Icon,
  title,
  description,
  arrivesIn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  arrivesIn: string;
}) {
  return (
    <Card className="opacity-60">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <Badge variant="secondary">Coming in {arrivesIn}</Badge>
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
