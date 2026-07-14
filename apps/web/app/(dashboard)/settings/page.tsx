import type { Metadata } from 'next';
import Link from 'next/link';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getBillingUsage, listBillingGrants } from '@/lib/api/billing';
import { getReminderSettings } from '@/lib/api/salon';
import { isApiError } from '@/lib/types';
import { ReminderSettingsForm } from '@/components/dashboard/reminder-settings-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceForm } from '@/components/dashboard/workspace-form';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { DangerZone } from '@/components/dashboard/danger-zone';
import { BillingUsagePanel } from '@/components/dashboard/billing-usage-panel';
import { RestartTourButton } from '@/components/dashboard/restart-tour-button';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await requireDashboardSession('/settings');
  const ws = session.active.workspace;
  const isOwner = session.active.role === 'owner';
  const canViewBilling = isOwner || session.active.role === 'manager';
  const defaultTab =
    searchParams.tab === 'billing' && canViewBilling
      ? 'billing'
      : searchParams.tab === 'profile'
        ? 'profile'
        : 'workspace';

  const [usageRes, grantsRes] = canViewBilling
    ? await Promise.all([getBillingUsage(ws.id), listBillingGrants(ws.id)])
    : [null, null];

  const isSalon = ws.vertical === 'salon';
  const reminderRes = isSalon ? await getReminderSettings(ws.id) : null;

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Workspace settings" />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canViewBilling && <TabsTrigger value="billing">Billing</TabsTrigger>}
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace details</CardTitle>
              <CardDescription>
                These appear across calls, messages, and your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkspaceForm
                defaultName={ws.name}
                defaultVertical={ws.vertical}
                slug={ws.slug}
                disabled={!isOwner}
              />
            </CardContent>
          </Card>

          {isSalon && reminderRes && !isApiError(reminderRes) && (
            <Card>
              <CardHeader>
                <CardTitle>Appointment messaging</CardTitle>
                <CardDescription>
                  Booking confirmations and automatic reminders to cut no-shows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReminderSettingsForm initial={reminderRes.data} canEdit={isOwner} />
              </CardContent>
            </Card>
          )}

          {isOwner && <DangerZone workspaceName={ws.name} />}
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>
                How your name shows up across the dashboard and team list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaultName={session.user.full_name ?? ''}
                email={session.user.email ?? ''}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product tour</CardTitle>
              <CardDescription>
                New here, or want a refresher? Replay the guided walkthrough of the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RestartTourButton />
            </CardContent>
          </Card>
        </TabsContent>

        {canViewBilling && (
          <TabsContent value="billing">
            {usageRes && !isApiError(usageRes) ? (
              <BillingUsagePanel
                usage={usageRes.data}
                grants={!isApiError(grantsRes!) ? grantsRes!.data : []}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Could not load usage data.{' '}
                  <Link href="/settings?tab=billing" className="text-accent underline">
                    Retry
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
