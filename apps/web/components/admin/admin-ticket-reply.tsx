'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import {
  adminReplyAction,
  adminTicketStatusAction,
} from '@/app/actions/admin-action';
import type { TicketStatus } from '@/lib/types';

interface AdminTicketReplyProps {
  ticketId: string;
  currentStatus: TicketStatus;
}

export function AdminTicketReply({ ticketId, currentStatus }: AdminTicketReplyProps) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    const res = await adminReplyAction(ticketId, body, internal);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setBody('');
    toast.success(internal ? 'Internal note saved' : 'Reply sent to user');
  }

  async function setStatus(status: TicketStatus) {
    setPending(true);
    const res = await adminTicketStatusAction(ticketId, status);
    setPending(false);
    if (res.error) toast.error(res.error);
    else toast.success(`Status set to ${status.replace('_', ' ')}`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label={internal ? 'Internal note (admin-only)' : 'Reply to user'} htmlFor="body">
          <Textarea
            id="body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              internal
                ? 'Notes other admins can see, hidden from the workspace user.'
                : 'The user receives this as an email and sees it on their ticket.'
            }
            required
            disabled={pending}
            className={internal ? 'border-warning/60 bg-warning/5' : undefined}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Internal note (admin-only)
          </label>
          <Button type="submit" disabled={pending || !body.trim()}>
            {pending ? 'Saving…' : internal ? 'Save note' : 'Send reply'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <div className="flex flex-wrap gap-2">
          {(['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as TicketStatus[]).map(
            (s) => (
              <Button
                key={s}
                size="sm"
                variant={currentStatus === s ? 'default' : 'outline'}
                onClick={() => setStatus(s)}
                disabled={pending}
                type="button"
              >
                {s.replace('_', ' ')}
              </Button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
