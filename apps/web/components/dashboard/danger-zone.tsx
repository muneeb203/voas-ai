'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteWorkspaceAction } from '@/app/actions/settings-action';

export function DangerZone({ workspaceName }: { workspaceName: string }) {
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    const result = await deleteWorkspaceAction();
    // Successful delete redirects; only get here on error.
    if (result?.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <Card className="border-error/30">
      <CardHeader>
        <CardTitle className="text-error">Danger zone</CardTitle>
        <CardDescription>
          Deleting a workspace removes access for all members. It's a soft delete — your data is
          preserved for 30 days in case you need to recover it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete workspace
        </Button>
      </CardContent>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete "${workspaceName}"?`}
        description="This will sign you out and revoke access for every member. You'll have 30 days to email support if you need to recover."
        confirmLabel="Delete workspace"
        destructive
        onConfirm={onConfirm}
      />
    </Card>
  );
}
