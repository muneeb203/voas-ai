'use client';

import { useState } from 'react';
import { MoreHorizontal, UserX, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { removeMemberAction, updateMemberRoleAction } from '@/app/actions/team-action';
import type { Member } from '@/lib/types';
import type { WorkspaceRole } from '@/lib/constants';

interface MemberRowActionsProps {
  member: Member;
  isSelf: boolean;
}

export function MemberRowActions({ member, isSelf }: MemberRowActionsProps) {
  const [removeOpen, setRemoveOpen] = useState(false);

  async function setRole(role: WorkspaceRole) {
    if (role === member.role) return;
    const res = await updateMemberRoleAction(member.id, role);
    if (res.error) toast.error(res.error);
    else toast.success(`Role updated to ${role}`);
  }

  async function onConfirmRemove() {
    const res = await removeMemberAction(member.id);
    if (res.error) toast.error(res.error);
    else toast.success('Member removed');
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Member actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <Shield className="mr-1 inline h-3 w-3" /> Role
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setRole('owner')}>
            Owner {member.role === 'owner' && '·'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRole('manager')}>
            Manager {member.role === 'manager' && '·'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRole('staff')}>
            Staff {member.role === 'staff' && '·'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => setRemoveOpen(true)}
            disabled={isSelf}
          >
            <UserX className="h-4 w-4" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove ${member.full_name ?? member.email ?? 'this member'}?`}
        description="They'll lose access immediately. You can invite them again later."
        confirmLabel="Remove"
        destructive
        onConfirm={onConfirmRemove}
      />
    </>
  );
}
