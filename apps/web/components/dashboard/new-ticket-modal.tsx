'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useActionState } from '@/lib/use-action-state';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createTicketAction,
  type CreateTicketFormState,
} from '@/app/actions/tickets-action';

const INITIAL: CreateTicketFormState = { status: 'idle' };

export function NewTicketButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTicketAction, INITIAL);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message);
    }
    // Success case: server action redirects, so we never get here.
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>
            Tell us what's going on. We typically reply within one business day.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <Field label="Subject" htmlFor="subject" required error={fieldErrors?.subject}>
            <Input
              id="subject"
              name="subject"
              placeholder="Short summary of the issue"
              required
              disabled={pending}
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category" required error={fieldErrors?.category}>
              <Select name="category" defaultValue="other" disabled={pending}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority" htmlFor="priority" required error={fieldErrors?.priority}>
              <Select name="priority" defaultValue="normal" disabled={pending}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="What's happening?" htmlFor="body" required error={fieldErrors?.body}>
            <Textarea
              id="body"
              name="body"
              rows={6}
              placeholder="Tell us what you tried, what you expected, and what actually happened."
              required
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
              {pending ? 'Creating…' : 'Create ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
