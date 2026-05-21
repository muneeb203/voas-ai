'use client';

import { useState } from 'react';
import { Copy, Check, MoreHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { revokeInvitationAction } from '@/app/actions/team-action';

interface InvitationRowActionsProps {
  invitationId: string;
  email: string;
}

export function InvitationRowActions({ invitationId, email }: InvitationRowActionsProps) {
  const [pending, setPending] = useState(false);

  async function onRevoke() {
    setPending(true);
    const res = await revokeInvitationAction(invitationId);
    setPending(false);
    if (res.error) toast.error(res.error);
    else toast.success(`Invitation to ${email} revoked`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Invitation actions"
          disabled={pending}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem destructive onSelect={onRevoke}>
          <X className="h-4 w-4" /> Revoke
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopyInviteUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      title="Copy invite link"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      Copy link
    </button>
  );
}
