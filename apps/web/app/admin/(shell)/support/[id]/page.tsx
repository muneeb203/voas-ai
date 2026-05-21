import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Lock } from 'lucide-react';
import { requireAdminSession } from '@/lib/auth/admin';
import { getAdminTicket } from '@/lib/api/admin';
import { isApiError, type SupportMessage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTicketReply } from '@/components/admin/admin-ticket-reply';
import { AttachmentList } from '@/components/dashboard/attachment-list';
import {
  StatusBadge,
  PriorityBadge,
  categoryLabel,
} from '@/components/dashboard/ticket-badges';
import { cn } from '@/lib/utils';

const STORAGE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`
  : '';

export const metadata: Metadata = {
  title: 'Admin · Ticket',
  robots: { index: false, follow: false },
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
  return m.sender_name ?? m.sender_email ?? 'User';
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const isAdmin = message.sender_type === 'admin';
  const isSystem = message.sender_type === 'system';
  const isInternal = message.is_internal_note;

  if (isSystem) {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        {message.body} ·{' '}
        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isAdmin ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback>{initials(message.sender_name, message.sender_email, isAdmin ? 'V' : 'U')}</AvatarFallback>
      </Avatar>

      <div className="max-w-[80%] space-y-1">
        <div
          className={cn(
            'flex items-baseline gap-2 text-xs',
            isAdmin ? 'justify-end' : 'justify-start',
          )}
        >
          <span className="font-medium text-foreground">{senderLabel(message)}</span>
          {isInternal && (
            <Badge variant="warning" className="gap-1">
              <Lock className="h-3 w-3" />
              Internal
            </Badge>
          )}
          <span className="text-muted-foreground">
            {format(new Date(message.created_at), 'MMM d, h:mm a')}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm whitespace-pre-wrap',
            isInternal
              ? 'border border-warning/40 bg-warning/10 text-foreground'
              : isAdmin
                ? 'bg-brand text-white'
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

export default async function AdminTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdminSession(`/admin/support/${params.id}`);

  const res = await getAdminTicket(params.id);
  if (isApiError(res)) {
    if (res.error.code === 'NOT_FOUND') notFound();
    throw new Error(res.error.message);
  }
  const ticket = res.data;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
      </Link>

      <AdminPageHeader
        eyebrow={`#${ticket.id.slice(0, 8)} · ${ticket.creator_email ?? 'unknown'}`}
        title={ticket.subject}
        description={
          <>
            <Link
              href={`/admin/workspaces/${ticket.workspace_id}`}
              className="text-accent-700 underline-offset-2 hover:underline"
            >
              View workspace
            </Link>
            {' · '}
            {categoryLabel(ticket.category)}
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages.</p>
          ) : (
            ticket.messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </CardContent>
      </Card>

      <AdminTicketReply ticketId={ticket.id} currentStatus={ticket.status} />
    </div>
  );
}
