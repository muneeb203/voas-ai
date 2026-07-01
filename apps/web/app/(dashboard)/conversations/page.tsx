import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listConversations } from '@/lib/api/conversations';
import { isApiError, type ConversationChannel, type ConversationStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  ChannelBadge,
  ConversationStatusBadge,
  SentimentBadge,
} from '@/components/dashboard/conversation-badges';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Conversations' };

const CHANNELS: { id: 'all' | ConversationChannel; label: string }[] = [
  { id: 'all', label: 'All channels' },
  { id: 'voice', label: 'Voice' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'chat', label: 'Chat' },
  { id: 'sms', label: 'SMS' },
  { id: 'kiosk', label: 'Kiosk' },
];

const STATUSES: { id: 'all' | ConversationStatus; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'ended', label: 'Ended' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'escalated', label: 'Escalated' },
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: { channel?: string; status?: string };
}) {
  const session = await requireDashboardSession('/conversations');

  const channel = CHANNELS.find((c) => c.id === searchParams.channel)?.id ?? 'all';
  const status = STATUSES.find((s) => s.id === searchParams.status)?.id ?? 'all';

  const res = await listConversations(session.active.workspace_id, {
    channel: channel !== 'all' ? channel : undefined,
    status: status !== 'all' ? status : undefined,
  });
  const conversations = !isApiError(res) ? res.data : [];

  function tabHref(updates: Partial<{ channel: string; status: string }>): string {
    const params = new URLSearchParams();
    const c = updates.channel ?? channel;
    const s = updates.status ?? status;
    if (c !== 'all') params.set('channel', c);
    if (s !== 'all') params.set('status', s);
    const qs = params.toString();
    return qs ? `/conversations?${qs}` : '/conversations';
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Conversations"
        description="Every call, WhatsApp thread, and chat in one place."
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-1">
          {CHANNELS.map((c) => (
            <Link
              key={c.id}
              href={tabHref({ channel: c.id })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                channel === c.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <span className="mx-2 h-5 w-px bg-border" />
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => (
            <Link
              key={s.id}
              href={tabHref({ status: s.id })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                status === s.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">No conversations yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Voice and WhatsApp integrations land in V2 Sprint 2 + 3. Once connected, every call
              and message will appear here in real time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/conversations/${c.id}`}
                        className="font-medium hover:text-accent-700"
                      >
                        {c.customer_name ?? c.customer_phone ?? 'Unknown'}
                      </Link>
                      {c.summary && (
                        <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                          {c.summary}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={c.channel} />
                    </TableCell>
                    <TableCell>
                      <ConversationStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      <SentimentBadge sentiment={c.sentiment} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(c.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
