'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useActionState } from '@/lib/use-action-state';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AttachmentPicker } from './attachment-picker';
import {
  markTicketResolvedAction,
  replyToTicketAction,
  type ReplyFormState,
} from '@/app/actions/tickets-action';
import type { AttachmentRef } from '@/lib/api/tickets';

const INITIAL: ReplyFormState = { status: 'idle' };

interface TicketReplyProps {
  ticketId: string;
  isResolved: boolean;
  isClosed: boolean;
}

export function TicketReply({ ticketId, isResolved, isClosed }: TicketReplyProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const reply = replyToTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(reply, INITIAL);
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  const [resolveOpen, setResolveOpen] = useState(false);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Reply sent');
      formRef.current?.reset();
      setAttachments([]);
    } else if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  async function onConfirmResolve() {
    const res = await markTicketResolvedAction(ticketId);
    if (res.error) toast.error(res.error);
    else toast.success('Ticket marked resolved');
  }

  if (isClosed) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        This ticket is closed. If you need more help, open a new ticket from the Support page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={formAction} className="space-y-3">
        <input
          type="hidden"
          name="attachments_json"
          value={JSON.stringify(attachments)}
        />

        <Field label="Add a reply" htmlFor="body" error={fieldErrors?.body}>
          <Textarea
            id="body"
            name="body"
            rows={4}
            placeholder="Write your reply…"
            required
            disabled={pending}
          />
        </Field>

        <AttachmentPicker
          ticketId={ticketId}
          attachments={attachments}
          onChange={setAttachments}
          disabled={pending}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send reply'}
          </Button>

          {!isResolved && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setResolveOpen(true)}
              disabled={pending}
            >
              Mark as resolved
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        title="Mark this ticket as resolved?"
        description="We'll close out the conversation. You can still reply on the ticket if it comes up again — that reopens it."
        confirmLabel="Mark resolved"
        onConfirm={onConfirmResolve}
      />
    </div>
  );
}
