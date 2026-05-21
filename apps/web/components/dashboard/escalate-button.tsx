'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { escalateConversationAction } from '@/app/actions/conversations-action';

export function EscalateButton({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await escalateConversationAction(conversationId, reason);
    setPending(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    // Success: server action redirects to /support/[ticketId]
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpRight className="h-4 w-4" /> Escalate to support
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate to support</DialogTitle>
          <DialogDescription>
            Creates a support ticket pre-filled with this conversation. The VOAS team picks it up
            in their inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="What needs human attention?"
            htmlFor="reason"
            hint="Optional — gives the support team context."
          >
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Customer wanted a refund the agent couldn't authorize."
              disabled={pending}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Escalating…' : 'Create ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
