'use client';

import { useState } from 'react';
import { ChevronDown, Eye, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  deleteWorkspaceAction,
  restoreWorkspaceAction,
  startImpersonationAction,
  suspendWorkspaceAction,
} from '@/app/actions/admin-action';

interface WorkspaceActionsProps {
  workspaceId: string;
  workspaceName: string;
  status: 'active' | 'suspended' | 'deleted';
}

export function WorkspaceActions({ workspaceId, workspaceName, status }: WorkspaceActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState<null | 'suspend' | 'restore' | 'delete'>(null);

  async function onImpersonate() {
    const res = await startImpersonationAction(workspaceId);
    if (res?.error) toast.error(res.error);
    // Success: server redirects to /dashboard
  }

  async function onConfirm() {
    if (!confirmOpen) return;
    let res: { error: string | null } | undefined;
    if (confirmOpen === 'suspend') res = await suspendWorkspaceAction(workspaceId);
    if (confirmOpen === 'restore') res = await restoreWorkspaceAction(workspaceId);
    if (confirmOpen === 'delete') {
      res = await deleteWorkspaceAction(workspaceId);
    }
    if (res?.error) toast.error(res.error);
    else toast.success('Done');
    setConfirmOpen(null);
  }

  const confirmCopy = {
    suspend: {
      title: `Suspend "${workspaceName}"?`,
      description:
        'Members will lose access until you restore. They keep their data and can be un-suspended at any time.',
      label: 'Suspend',
      destructive: false,
    },
    restore: {
      title: `Restore "${workspaceName}"?`,
      description: 'Members regain access immediately.',
      label: 'Restore',
      destructive: false,
    },
    delete: {
      title: `Delete "${workspaceName}"?`,
      description:
        'Soft delete. Data stays in the database for 30 days; restore requires database access.',
      label: 'Delete workspace',
      destructive: true,
    },
  } as const;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="accent" onClick={onImpersonate}>
          <Eye className="h-4 w-4" /> View as workspace
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {status === 'active' ? (
              <DropdownMenuItem onSelect={() => setConfirmOpen('suspend')}>
                <PauseCircle className="h-4 w-4" /> Suspend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConfirmOpen('restore')}>
                <PlayCircle className="h-4 w-4" /> Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen('delete')}>
              <Trash2 className="h-4 w-4" /> Delete workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmOpen !== null}
        onOpenChange={(o) => !o && setConfirmOpen(null)}
        title={confirmOpen ? confirmCopy[confirmOpen].title : ''}
        description={confirmOpen ? confirmCopy[confirmOpen].description : ''}
        confirmLabel={confirmOpen ? confirmCopy[confirmOpen].label : 'Confirm'}
        destructive={confirmOpen ? confirmCopy[confirmOpen].destructive : false}
        onConfirm={onConfirm}
      />
    </>
  );
}
