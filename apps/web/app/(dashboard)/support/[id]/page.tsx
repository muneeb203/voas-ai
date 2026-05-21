import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getTicket } from '@/lib/api/tickets';
import { isApiError, type SupportMessage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  StatusBadge,
  PriorityBadge,
  categoryLabel,
} from '@/components/dashboard/ticket-badges';
import { TicketReply } from '@/components/dashboard/ticket-reply';
import { AttachmentList } from '@/components/dashboard/attachment-list';
import { cn } from '@/lib/utils';

const STORAGE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`
  : '';

export const metadata: Metadata = {
  title: 'Ticket',
};

function initials(name: string | null, email: string | null, fallback: string): string {
  const src = (name ?? email ?? fallback).trim();
  if (!src) return fallback.toUpperCase();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function senderLabel(m: SupportMessage): string {
  if (m.sender_type === 'admin') return m.sender_name ?? 'VOAS team';
  if (m.sender_type === 'system') return 'System';
  return m.sender_name ?? m.sender_email ?? 'You';
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: SupportMessage;
  isOwn: boolean;
}) {
  const isAdmin = message.sender_type === 'admin';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        {message.body} ·{' '}
        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar
        className={cn('h-8 w-8 flex-shrink-0', isAdmin && '[&_[data-radix-avatar-fallback]]:bg-accent')}
      >
        <AvatarFallback>{initials(message.sender_name, message.sender_email, isAdmin ? 'V' : 'U')}</AvatarFallback>
      </Avatar>

      <div className={cn('max-w-[80%] space-y-1', isOwn && 'items-end')}>
        <div
          className={cn(
            'flex items-baseline gap-2 text-xs',
            isOwn ? 'justify-end' : 'justify-start',
          )}
        >
          <span className="font-medium text-foreground">{senderLabel(message)}</span>
          <span className="text-muted-foreground">
            {format(new Date(message.created_at), 'MMM d, h:mm a')}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm whitespace-pre-wrap',
            isOwn
              ? 'bg-brand text-white'
              : isAdmin
                ? 'bg-accent/10 text-foreground'
                : 'bg-muted text-foreground',
          )}
        >
          {message.body}
        </div>
        <AttachmentList attachments={message.attachments} storageBase={STORAGE_BASE} />
      </div>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await requireDashboardSession(`/support/${params.id}`);

  const res = await getTicket(session.active.workspace_id, params.id);
  if (isApiError(res)) {
    if (res.error.code === 'NOT_FOUND') notFound();
    throw new Error(res.error.message);
  }

  const ticket = res.data;
  const isResolved = ticket.status === 'resolved';
  const isClosed = ticket.status === 'closed';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tickets
        </Link>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-xs text-muted-foreground">
            {categoryLabel(ticket.category)} · #{ticket.id.slice(0, 8)}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {ticket.subject}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opened {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          {ticket.resolved_at && (
            <>
              {' · '}
              Resolved {formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true })}
            </>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            ticket.messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.sender_type === 'user' && m.sender_id === session.user.id}
              />
            ))
          )}
        </CardContent>
      </Card>

      <TicketReply ticketId={ticket.id} isResolved={isResolved} isClosed={isClosed} />
    </div>
  );
}
