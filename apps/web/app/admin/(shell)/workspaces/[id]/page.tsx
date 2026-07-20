import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { requireAdminSession } from '@/lib/auth/admin';
import { getAdminWorkspace, listAdminTickets, listAdminAuditLogs, getAdminWorkspaceUsage, listAdminWorkspaceGrants, getAdminKioskSettings, getAdminKioskMetrics, listAdminWorkspaceActivity, getAdminWorkspaceUsageHistory, listAdminWorkspaceErrors, getAdminWorkspaceKnowledgeBase } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminWorkspaceBillingPanel } from '@/components/admin/admin-workspace-billing-panel';
import { AdminKioskSettingsCard } from '@/components/admin/admin-kiosk-settings-card';
import { AdminKioskMetricsCard } from '@/components/admin/admin-kiosk-metrics-card';
import { AdminVoiceModelCard } from '@/components/admin/admin-voice-model-card';
import { AdminKnowledgeBasePanel } from '@/components/admin/admin-knowledge-base-panel';
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

const TABS = [
  'overview',
  'billing',
  'kiosk',
  'members',
  'locations',
  'tickets',
  'log',
  'usage',
  'kb',
];

type LogCategory = 'config' | 'operation' | 'error';

interface LogRow {
  at: string;
  category: LogCategory;
  label: string;
  title: string;
  subtitle: string | null;
}

const LOG_FILTERS: { id: 'all' | LogCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'operation', label: 'Operations' },
  { id: 'config', label: 'Config changes' },
  { id: 'error', label: 'Errors' },
];

function OverviewField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-medium">{children}</div>
    </div>
  );
}

function categoryBadge(category: LogCategory) {
  if (category === 'error') return <Badge variant="destructive">error</Badge>;
  if (category === 'config') return <Badge variant="outline">config</Badge>;
  return <Badge variant="secondary">activity</Badge>;
}

export default async function AdminWorkspaceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; log?: string };
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
    kbRes,
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
    getAdminWorkspaceKnowledgeBase(params.id),
  ]);

  if (isApiError(detailRes)) {
    if (detailRes.error.code === 'NOT_FOUND') notFound();
    throw new Error(detailRes.error.message);
  }
  const { workspace, members, locations } = detailRes.data;
  const tickets = !isApiError(ticketsRes) ? ticketsRes.data : [];
  const auditEntries = !isApiError(auditRes) ? auditRes.data : [];
  // Keep the failure reason: an errored endpoint and a genuinely empty tab look
  // identical otherwise, which makes "no logs showing" impossible to diagnose.
  const activity = !isApiError(activityRes) ? activityRes.data : [];
  const activityError = isApiError(activityRes) ? activityRes.error.message : null;
  const usageHistory = !isApiError(usageHistoryRes) ? usageHistoryRes.data : [];
  const usageHistoryError = isApiError(usageHistoryRes) ? usageHistoryRes.error.message : null;
  const errors = !isApiError(errorsRes) ? errorsRes.data : [];
  const errorsError = isApiError(errorsRes) ? errorsRes.error.message : null;
  const kb = !isApiError(kbRes) ? kbRes.data : null;
  const kbError = isApiError(kbRes) ? kbRes.error.message : null;

  // One timeline instead of three tabs: config changes (audit), what the
  // business did (activity), and what broke (errors) are the same story told in
  // sequence — you shouldn't have to guess which tab an event landed in.
  const logRows: LogRow[] = [
    ...auditEntries.map((e) => ({
      at: e.created_at,
      category: 'config' as const,
      label: e.action,
      title: e.actor_name ?? e.actor_email ?? e.actor_type,
      subtitle: e.resource_type ? `${e.resource_type} ${e.resource_id ?? ''}`.trim() : null,
    })),
    ...activity.map((a) => ({
      at: a.at,
      category: 'operation' as const,
      label: a.kind,
      title: a.title,
      subtitle: a.subtitle,
    })),
    ...errors.map((e) => ({
      at: e.created_at,
      category: 'error' as const,
      label: e.kind,
      title: e.source,
      subtitle: e.message,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const logFilter = (['config', 'operation', 'error'] as const).includes(
    searchParams.log as 'config' | 'operation' | 'error',
  )
    ? (searchParams.log as 'config' | 'operation' | 'error')
    : 'all';
  const visibleLog =
    logFilter === 'all' ? logRows : logRows.filter((r) => r.category === logFilter);
  const logLoadError = activityError ?? errorsError;
  const kioskSettings = !isApiError(kioskRes)
    ? kioskRes.data
    : { kiosk_enabled: false, max_kiosk_urls: 1, theme: 'gradient' as const, session_lock_enabled: false, kiosk_monthly_limit: 500, kiosk_credits_balance: 0, kiosk_credits_used_this_month: 0, kiosk_month_start: null, manual_ordering_enabled: false };
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
  // Must honour ?tab= for every tab: the Log filter links round-trip through the
  // server, so anything not listed here would bounce the admin back to Overview.
  const defaultTab = TABS.includes(searchParams.tab ?? '') ? searchParams.tab! : 'overview';

  // Support-facing summary: who to contact, where they are, and whether the
  // account is actually alive — without hopping between tabs.
  const owner = members.find((m) => m.role === 'owner');
  const primaryLocation = locations.find((l) => l.is_active) ?? locations[0];
  const lastActivityAt = activity[0]?.at ?? null;
  // errors is capped at the endpoint's limit, so don't imply an exact count.
  const errorCount = errors.length >= 100 ? '100+' : String(errors.length);

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
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="kb">Knowledge base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <OverviewField label="Status">
                <span className="capitalize">{workspace.status}</span>
              </OverviewField>
              <OverviewField label="Vertical">
                <span className="capitalize">{workspace.vertical}</span>
              </OverviewField>
              <OverviewField label="Plan">
                <span className="capitalize">{workspace.plan}</span>
              </OverviewField>
              <OverviewField label="Created">
                {formatDistanceToNow(new Date(workspace.created_at), { addSuffix: true })}
              </OverviewField>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="space-y-4 p-6">
                <p className="text-sm font-semibold">Owner</p>
                {owner ? (
                  <>
                    <OverviewField label="Name">{owner.full_name ?? '—'}</OverviewField>
                    <OverviewField label="Email">
                      {owner.email ? (
                        <a href={`mailto:${owner.email}`} className="text-accent underline">
                          {owner.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </OverviewField>
                    <OverviewField label="Joined">
                      {owner.joined_at
                        ? formatDistanceToNow(new Date(owner.joined_at), { addSuffix: true })
                        : 'Not yet accepted'}
                    </OverviewField>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No owner on this workspace — that&apos;s unusual, worth a look.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <p className="text-sm font-semibold">Primary location</p>
                {primaryLocation ? (
                  <>
                    <OverviewField label="Name">{primaryLocation.name}</OverviewField>
                    <OverviewField label="Phone">
                      {primaryLocation.phone ? (
                        <a href={`tel:${primaryLocation.phone}`} className="text-accent underline">
                          {primaryLocation.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </OverviewField>
                    <OverviewField label="City">{primaryLocation.city ?? '—'}</OverviewField>
                    <OverviewField label="Timezone">
                      <span className="font-mono text-xs">{primaryLocation.timezone}</span>
                    </OverviewField>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No location set — bookings and hours can&apos;t work without one.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <p className="text-sm font-semibold">Health</p>
                <OverviewField label="Voice agent">
                  {kb?.voice ? (
                    <Badge variant={kb.voice.enabled ? 'success' : 'secondary'}>
                      {kb.voice.enabled ? 'Enabled' : 'Off'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not set up</Badge>
                  )}
                </OverviewField>
                <OverviewField label="Errors (30d)">
                  {errorsError ? (
                    <span className="text-xs text-muted-foreground">unavailable</span>
                  ) : (
                    <span className={errors.length ? 'text-error' : undefined}>{errorCount}</span>
                  )}
                </OverviewField>
                <OverviewField label="Last activity">
                  {lastActivityAt
                    ? formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true })
                    : 'Never used'}
                </OverviewField>
              </CardContent>
            </Card>

            <div className="md:col-span-2">
              <AdminVoiceModelCard
                workspaceId={workspace.id}
                currentModel={kb?.voice?.model ?? null}
              />
            </div>
          </div>
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
            <AdminKioskSettingsCard workspaceId={workspace.id} settings={kioskSettings} plan={workspace.plan} vertical={workspace.vertical} />
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

        <TabsContent value="log">
          <div className="mb-4 flex items-center gap-1 border-b border-border">
            {LOG_FILTERS.map((f) => (
              <Link
                key={f.id}
                href={`/admin/workspaces/${params.id}?tab=log${f.id === 'all' ? '' : `&log=${f.id}`}`}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  logFilter === f.id
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {logLoadError ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-error">Couldn&apos;t load the log</p>
                  <p className="mt-1 text-xs text-muted-foreground">{logLoadError}</p>
                </div>
              ) : visibleLog.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nothing logged yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLog.map((r, i) => (
                      <TableRow key={`${r.category}-${r.at}-${i}`}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>{categoryBadge(r.category)}</TableCell>
                        <TableCell className="text-sm">
                          <p className="font-medium">{r.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">{r.label}</p>
                        </TableCell>
                        <TableCell className="max-w-md break-words text-xs text-muted-foreground">
                          {r.subtitle ?? '—'}
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
              {usageHistoryError ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-error">Couldn&apos;t load usage</p>
                  <p className="mt-1 text-xs text-muted-foreground">{usageHistoryError}</p>
                </div>
              ) : (
                usageHistory.every(
                  (p) => !p.voice_minutes && !p.whatsapp_messages && !p.help_bot_turns,
                ) && (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No usage recorded in the last 30 days.
                  </p>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="kb">
          {kbError ? (
            <Card>
              <CardContent className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-error">Couldn&apos;t load the knowledge base</p>
                <p className="mt-1 text-xs text-muted-foreground">{kbError}</p>
              </CardContent>
            </Card>
          ) : kb ? (
            <AdminKnowledgeBasePanel kb={kb} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
