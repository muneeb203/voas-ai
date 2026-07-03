'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { topupKioskCreditsAction } from '@/app/actions/admin-action';
import type { AdminKioskSettings } from '@/lib/api/admin';

interface AdminKioskSettingsCardProps {
  workspaceId: string;
  settings: AdminKioskSettings;
  plan?: string;
}

export function AdminKioskSettingsCard({ workspaceId, settings }: AdminKioskSettingsCardProps) {
  const [topupAmount, setTopupAmount] = useState(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const balance = settings.kiosk_credits_balance;

  async function handleTopup() {
    if (topupAmount < 1) return;
    setToppingUp(true);
    const res = await topupKioskCreditsAction(workspaceId, topupAmount);
    setToppingUp(false);
    setConfirmOpen(false);
    if (res?.error) toast.error(res.error);
    else toast.success(`Added ${topupAmount} kiosk credits.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiosk Credits</CardTitle>
        <CardDescription>
          Each kiosk order uses 1 credit. New workspaces start with 10 free. You can add more —
          credits stack on top of the balance and cannot be revoked once added.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Current balance</p>
          <span className="text-sm font-semibold tabular-nums">
            {balance.toLocaleString()} credits
          </span>
        </div>

        <div className="space-y-2 border-t pt-5">
          <Label htmlFor="topup-amount">Add credits</Label>
          <p className="text-xs text-muted-foreground">
            Added instantly and stacked onto the balance. This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="topup-amount"
              type="number"
              min={1}
              max={100000}
              value={topupAmount}
              onChange={(e) => setTopupAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-28"
            />
            <Button onClick={() => setConfirmOpen(true)} disabled={toppingUp || topupAmount < 1}>
              Add credits
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(v) => !toppingUp && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {topupAmount} kiosk credits?</DialogTitle>
            <DialogDescription>
              This adds {topupAmount} credits on top of the current {balance.toLocaleString()}.
              Credits cannot be revoked once added.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={toppingUp}>
              Cancel
            </Button>
            <Button onClick={handleTopup} disabled={toppingUp}>
              {toppingUp ? 'Adding…' : `Add ${topupAmount} credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
