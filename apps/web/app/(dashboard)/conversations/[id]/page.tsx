import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bot, ExternalLink, User, Volume2 } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getConversation } from '@/lib/api/conversations';
import { isApiError, type ConversationMessage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  ChannelBadge,
  ConversationStatusBadge,
  SentimentBadge,
} from '@/components/dashboard/conversation-badges';
import { EscalateButton } from '@/components/dashboard/escalate-button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Conversation' };

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function MessageRow({ message }: { message: ConversationMessage }) {
  const isAgent = message.role === 'agent';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="my-2 text-center text-xs italic text-muted-foreground">
        {message.content} · {format(new Date(message.created_at), 'h:mm:ss a')}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isAgent ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isAgent ? 'bg-accent text-white' : 'bg-brand text-white',
        )}
      >
        {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn('max-w-[80%] space-y-1', isAgent && 'items-end')}>
        <div
          className={cn(
            'flex items-baseline gap-2 text-xs',
            isAgent ? 'justify-end' : 'justify-start',
          )}
        >
          <span className="font-medium text-foreground">
            {isAgent ? 'Agent' : 'Customer'}
          </span>
          <span className="text-muted-foreground">
            {format(new Date(message.created_at), 'h:mm:ss a')}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
            isAgent ? 'bg-accent/10 text-foreground' : 'bg-muted text-foreground',
          )}
        >
          {message.content}
        </div>
        {message.audio_url && (
          <a
            href={message.audio_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
          >
            <Volume2 className="h-3 w-3" /> Listen
          </a>
        )}
      </div>
    </div>
  );
}

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireDashboardSession(`/conversations/${params.id}`);

  const res = await getConversation(session.active.workspace_id, params.id);
  if (isApiError(res)) {
    if (res.error.code === 'NOT_FOUND') notFound();
    throw new Error(res.error.message);
  }
  const c = res.data;
  const canEscalate = c.status !== 'escalated';

  return (
    <div className="space-y-6">
      <Link
        href="/conversations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to conversations
      </Link>

      <PageHeader
        eyebrow={`#${c.id.slice(0, 8)}`}
        title={c.customer_name ?? c.customer_phone ?? 'Unknown customer'}
        description={
          <span className="flex items-center gap-2">
            <ChannelBadge channel={c.channel} />
            <ConversationStatusBadge status={c.status} />
            <SentimentBadge sentiment={c.sentiment} />
          </span>
        }
        action={canEscalate ? <EscalateButton conversationId={c.id} /> : null}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-4 p-6">
            {c.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              c.messages.map((m) => <MessageRow key={m.id} message={m} />)
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {c.summary && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI summary
                </p>
                <p className="text-sm leading-relaxed">{c.summary}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <Row label="Started">
                {format(new Date(c.started_at), 'MMM d, h:mm a')}
                <span className="text-muted-foreground">
                  {' · '}
                  {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}
                </span>
              </Row>
              {c.ended_at && (
                <Row label="Ended">{format(new Date(c.ended_at), 'h:mm a')}</Row>
              )}
              <Row label="Duration">{formatDuration(c.duration_seconds)}</Row>
              {c.customer_phone && <Row label="Phone">{c.customer_phone}</Row>}
              {c.outcome && <Row label="Outcome">{c.outcome.replace(/_/g, ' ')}</Row>}
              {c.recording_url && (
                <Row label="Recording">
                  <a
                    href={c.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-700 hover:underline"
                  >
                    Listen
                  </a>
                </Row>
              )}
            </CardContent>
          </Card>

          {c.customer && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer
                </p>
                <p className="text-sm font-medium">
                  {c.customer.name ?? c.customer.phone ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.customer.total_orders} previous orders · $
                  {(c.customer.total_spent_cents / 100).toFixed(2)} lifetime
                </p>
              </CardContent>
            </Card>
          )}

          {c.order_id && (
            <Card>
              <CardContent className="p-4">
                <Link
                  href={`/orders/${c.order_id}`}
                  className="flex items-center justify-between text-sm font-medium hover:text-accent-700"
                >
                  View linked order
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
