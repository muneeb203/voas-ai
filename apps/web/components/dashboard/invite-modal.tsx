'use client';

import { useState } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { Copy, Plus, Check } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createInvitationAction,
  type InviteFormState,
} from '@/app/actions/team-action';

const INITIAL: InviteFormState = { status: 'idle' };

export function InviteMemberButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInvitationAction, INITIAL);
  const [copied, setCopied] = useState(false);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Highlight and copy manually.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            We'll generate a private link you can send them. In dev, no email is sent — just copy
            the link from here.
          </DialogDescription>
        </DialogHeader>

        {state.status === 'success' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm font-medium">Invite created for {state.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send this link to them. It expires in 7 days.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Input value={state.url} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant={copied ? 'accent' : 'outline'}
                  size="icon"
                  onClick={() => copyUrl(state.url)}
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <Field label="Email" htmlFor="email" required error={fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                autoFocus
              />
            </Field>

            <Field label="Role" htmlFor="role" required error={fieldErrors?.role}>
              <Select name="role" defaultValue="staff" disabled={pending}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner — full access</SelectItem>
                  <SelectItem value="manager">Manager — can edit settings & locations</SelectItem>
                  <SelectItem value="staff">Staff — view conversations & orders</SelectItem>
                </SelectContent>
              </Select>
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
                {pending ? 'Creating…' : 'Create invite'}
              </Button>
            </DialogFooter>

            {state.status === 'error' && !state.fieldErrors && (
              <p className="text-sm text-error" role="alert">
                {state.message}
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
