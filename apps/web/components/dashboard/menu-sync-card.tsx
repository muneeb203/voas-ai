'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resyncMenuToVapiAction } from '@/app/actions/voice-action';

interface MenuSyncCardProps {
  menuDirty: boolean;
  lastSyncedAt: string | null;
  lastMenuUpdate: string | null;
  disabled?: boolean;
}

export function MenuSyncCard({
  menuDirty,
  lastSyncedAt,
  lastMenuUpdate,
  disabled,
}: MenuSyncCardProps) {
  const [pending, setPending] = useState(false);

  async function onResync() {
    setPending(true);
    const res = await resyncMenuToVapiAction();
    setPending(false);
    if (res.error) toast.error(res.error);
    else toast.success('Menu synced to agent');
  }

  if (menuDirty) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium">Menu out of sync</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You've edited the menu since the agent was last synced
                {lastMenuUpdate && (
                  <>
                    {' '}
                    ({formatDistanceToNow(new Date(lastMenuUpdate), { addSuffix: true })})
                  </>
                )}
                . The agent will not know about your changes until you re-sync.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={onResync}
            disabled={disabled || pending}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            {pending ? 'Syncing…' : 'Re-sync menu to agent'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium">Menu is in sync</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastSyncedAt
                ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
                : 'No menu yet.'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResync}
          disabled={disabled || pending}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Syncing…' : 'Re-sync anyway'}
        </Button>
      </CardContent>
    </Card>
  );
}
