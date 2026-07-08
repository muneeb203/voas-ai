import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getVoiceCapabilities, getVoiceSettings } from '@/lib/api/voice';
import { getBillingUsage } from '@/lib/api/billing';
import { PAY_AS_YOU_GO } from '@/lib/constants';
import { isApiError } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { VoiceSettingsForm } from '@/components/dashboard/voice-settings-form';
import { TestCallButton } from '@/components/dashboard/test-call-button';
import { MenuSyncCard } from '@/components/dashboard/menu-sync-card';
import { VoiceMinutesCard } from '@/components/dashboard/voice-minutes-card';
import { VoiceSetupGuide } from '@/components/dashboard/voice-setup-guide';

export const metadata: Metadata = { title: 'Voice settings' };

export default async function VoiceSettingsPage() {
  const session = await requireDashboardSession('/integrations/voice');
  const isOwner = session.active.role === 'owner';
  const workspaceId = session.active.workspace_id;
  const workspaceName = session.active.workspace.name;

  const [settingsRes, capsRes, billingRes] = await Promise.all([
    getVoiceSettings(workspaceId),
    getVoiceCapabilities(),
    getBillingUsage(workspaceId),
  ]);

  if (isApiError(settingsRes)) throw new Error(settingsRes.error.message);
  if (isApiError(capsRes)) throw new Error(capsRes.error.message);

  const settings = settingsRes.data;
  const caps = capsRes.data;
  const billing = !isApiError(billingRes) ? billingRes.data : null;

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
        title="Voice"
        description="Configure your AI agent's prompt + voice. Phone numbers are configured per location."
      />

      <VoiceSetupGuide />

      {!caps.vapi_configured && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div>
            <p className="font-medium">Vapi keys are not set in the backend.</p>
            <p className="mt-1 text-muted-foreground">
              You can edit settings here, but no real calls happen until an admin adds{' '}
              <code className="font-mono text-xs">VAPI_API_KEY</code> +{' '}
              <code className="font-mono text-xs">VAPI_PUBLIC_KEY</code> to the API env. See{' '}
              <Link href="/support" className="underline">
                docs/voice-setup.md
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Agent personality</CardTitle>
            <CardDescription>
              Your menu is appended to the system prompt automatically when you save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceSettingsForm
              settings={settings}
              capabilities={caps}
              disabled={!isOwner}
              workspaceName={workspaceName}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Voice minutes — shown first so low-credit warnings are impossible to miss */}
          {billing && <VoiceMinutesCard usage={billing} />}

          <Card>
            <CardContent className="p-4 text-xs">
              <p className="font-medium text-foreground">Pay-as-you-go rate</p>
              <p className="mt-1 text-muted-foreground">
                Beyond your plan, voice is billed at{' '}
                <span className="font-medium text-foreground">
                  ${PAY_AS_YOU_GO.voicePerMinute.toFixed(2)} / minute
                </span>
                . Test calls count toward usage.
              </p>
            </CardContent>
          </Card>

          <MenuSyncCard
            menuDirty={settings.menu_dirty}
            lastSyncedAt={settings.last_synced_at}
            lastMenuUpdate={settings.last_menu_update}
            disabled={!isOwner}
          />

          <Card>
            <CardHeader>
              <CardTitle>Test call</CardTitle>
              <CardDescription>
                Talk to your agent through the browser — no phone needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TestCallButton
                publicKey={caps.vapi_public_key}
                assistantId={settings.vapi_assistant_id}
                disabled={!isOwner}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Grant mic access when prompted. Test calls also count toward Vapi usage.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-xs">
              <div>
                <p className="font-medium text-foreground">Phone numbers</p>
                <p className="mt-1 text-muted-foreground">
                  Configure a phone number per location from the{' '}
                  <Link href="/locations" className="underline">
                    Locations
                  </Link>{' '}
                  page. We use your own Twilio account.
                </p>
              </div>
              <div className="pt-2">
                <p className="font-medium text-foreground">Vapi assistant id</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {settings.vapi_assistant_id ?? 'Not yet provisioned — save to create.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
