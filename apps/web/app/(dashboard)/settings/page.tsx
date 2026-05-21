import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceForm } from '@/components/dashboard/workspace-form';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { DangerZone } from '@/components/dashboard/danger-zone';
import { PLANS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const session = await requireDashboardSession('/settings');
  const ws = session.active.workspace;
  const isOwner = session.active.role === 'owner';

  const currentPlan = PLANS.find((p) => p.id === ws.plan);

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Workspace settings" />

      <Tabs defaultValue="workspace" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
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

          {isOwner && <DangerZone workspaceName={ws.name} />}
        </TabsContent>

        <TabsContent value="profile">
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
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Stripe billing arrives in V2. Until then, your workspace is on the trial plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">{currentPlan?.name ?? ws.plan}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan?.blurb ?? 'Current plan'}
                  </p>
                </div>
                <Badge variant="secondary">No charges yet</Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                When billing turns on, you'll get an email and a chance to upgrade or stay where you
                are.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
