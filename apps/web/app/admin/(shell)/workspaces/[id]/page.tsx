import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { requireAdminSession } from '@/lib/auth/admin';
import { getAdminWorkspace, listAdminTickets, listAdminAuditLogs, getAdminWorkspaceUsage, listAdminWorkspaceGrants, getAdminKioskSettings, getAdminKioskMetrics, listAdminWorkspaceActivity, getAdminWorkspaceUsageHistory, listAdminWorkspaceErrors } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminWorkspaceBillingPanel } from '@/components/admin/admin-workspace-billing-panel';
import { AdminKioskSettingsCard } from '@/components/admin/admin-kiosk-settings-card';
import { AdminKioskMetricsCard } from '@/components/admin/admin-kiosk-metrics-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { WorkspaceActions } from '@/components/admin/workspace-actions';
import {
  StatusBadge,
  PriorityBadge,
} from '@/components/dashboard/ticket-badges';

export const metadata: Metadata = {
  title: 'Admin · Workspace',
  robots: { index: false, follow: false },
};

export default async function AdminWorkspaceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  await requireAdminSession(`/admin/workspaces/${params.id}`);

  const [
    detailRes,
    ticketsRes,
    auditRes,
    usageRes,
    grantsRes,
    kioskRes,
    kioskMetricsRes,
    activityRes,
    usageHistoryRes,
    errorsRes,
  ] = await Promise.all([
    getAdminWorkspace(params.id),
    listAdminTickets({ workspaceId: params.id }),
    listAdminAuditLogs({ workspace_id: params.id }),
    getAdminWorkspaceUsage(params.id),
    listAdminWorkspaceGrants(params.id),
    getAdminKioskSettings(params.id),
    getAdminKioskMetrics(params.id),
    listAdminWorkspaceActivity(params.id),
    getAdminWorkspaceUsageHistory(params.id),
    listAdminWorkspaceErrors(params.id),
  ]);

  if (isApiError(detailRes)) {
    if (detailRes.error.code === 'NOT_FOUND') notFound();
    throw new Error(detailRes.error.message);
  }
  const { workspace, members, locations } = detailRes.data;
  const tickets = !isApiError(ticketsRes) ? ticketsRes.data : [];
  const auditEntries = !isApiError(auditRes) ? auditRes.data : [];
  const activity = !isApiError(activityRes) ? activityRes.data : [];
  const usageHistory = !isApiError(usageHistoryRes) ? usageHistoryRes.data : [];
  const errors = !isApiError(errorsRes) ? errorsRes.data : [];
  const kioskSettings = !isApiError(kioskRes)
    ? kioskRes.data
    : { kiosk_enabled: false, max_kiosk_urls: 1, theme: 'gradient' as const, session_lock_enabled: false, kiosk_monthly_limit: 500, kiosk_credits_balance: 0, kiosk_credits_used_this_month: 0, kiosk_month_start: null };
  const emptyWindow = {
    total_turns: 0,
    deepgram_turns: 0,
    avg_confidence: null,
    avg_chat_ms: null,
    avg_tts_ms: null,
    orders_placed: 0,
  };
  const kioskMetrics = !isApiError(kioskMetricsRes)
    ? kioskMetricsRes.data
    : { window_7d: emptyWindow, window_30d: emptyWindow, window_all: emptyWindow };
  const defaultTab = searchParams.tab === 'billing' ? 'billing' : 'overview';

  return (
    <div>
      <Link
        href="/admin/workspaces"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspaces
      </Link>

      <AdminPageHeader
        eyebrow={`#${workspace.id.slice(0, 8)}`}
        title={workspace.name}
        description={`${workspace.slug} · ${workspace.vertical} · ${workspace.plan} plan`}
        action={
          <WorkspaceActions
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            status={workspace.status}
          />
        }
      />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="kiosk">Kiosk</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="locations">Locations ({locations.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="errors">Errors{errors.length ? ` (${errors.length})` : ''}</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-medium capitalize">{workspace.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Vertical</p>
                <p className="mt-1 text-sm font-medium capitalize">{workspace.vertical}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Plan</p>
                <p className="mt-1 text-sm font-medium capitalize">{workspace.plan}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="mt-1 text-sm font-medium">
                  {formatDistanceToNow(new Date(workspace.created_at), { addSuffix: true })}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          {usageRes && !isApiError(usageRes) ? (
            <AdminWorkspaceBillingPanel
              workspaceId={workspace.id}
              usage={usageRes.data}
              grants={!isApiError(grantsRes) ? grantsRes.data : []}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                Could not load billing data for this workspace.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="kiosk">
          <div className="space-y-6">
            <AdminKioskMetricsCard metrics={kioskMetrics} />
            <AdminKioskSettingsCard workspaceId={workspace.id} settings={kioskSettings} plan={workspace.plan} />
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{m.email ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.joined_at
                          ? formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[l.address, l.city, l.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.phone ?? '—'}</TableCell>
                      <TableCell>
                        {l.is_active ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/support/${t.id}`} className="hover:text-accent-700">
                          {t.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No calls, chats, orders or bookings yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((a) => (
                      <TableRow key={`${a.kind}-${a.id}`}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{a.kind}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className="font-medium">{a.title}</p>
                          {a.subtitle && (
                            <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.status ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voice minutes</TableHead>
                    <TableHead>WhatsApp messages</TableHead>
                    <TableHead>Help-bot turns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageHistory
                    .filter(
                      (p) => p.voice_minutes || p.whatsapp_messages || p.help_bot_turns,
                    )
                    .reverse()
                    .map((p) => (
                      <TableRow key={p.date}>
                        <TableCell className="whitespace-nowrap text-sm">{p.date}</TableCell>
                        <TableCell className="text-sm">{p.voice_minutes.toFixed(1)}</TableCell>
                        <TableCell className="text-sm">{p.whatsapp_messages}</TableCell>
                        <TableCell className="text-sm">{p.help_bot_turns}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {usageHistory.every(
                (p) => !p.voice_minutes && !p.whatsapp_messages && !p.help_bot_turns,
              ) && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No usage recorded in the last 30 days.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardContent className="p-0">
              {errors.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No errors recorded for this business. 🎉
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.kind === 'crash' ? 'destructive' : 'secondary'}>
                            {e.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.source}</TableCell>
                        <TableCell className="max-w-md break-words text-xs text-muted-foreground">
                          {e.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.actor_name ?? e.actor_email ?? e.actor_id.slice(0, 8)}
                        <p className="text-xs text-muted-foreground">{e.actor_type}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.resource_type ? `${e.resource_type} · ${(e.resource_id ?? '').slice(0, 8)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
