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
import { Switch } from '@/components/ui/switch';
import {
  topupKioskCreditsAction,
  updateAdminKioskSettingsAction,
} from '@/app/actions/admin-action';
import type { AdminKioskSettings } from '@/lib/api/admin';

interface AdminKioskSettingsCardProps {
  workspaceId: string;
  settings: AdminKioskSettings;
  plan?: string;
  vertical?: string;
}

export function AdminKioskSettingsCard({
  workspaceId,
  settings,
  vertical,
}: AdminKioskSettingsCardProps) {
  const [topupAmount, setTopupAmount] = useState(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [manualOn, setManualOn] = useState(settings.manual_ordering_enabled);
  const [mode, setMode] = useState<'voice' | 'manual' | 'both'>(settings.kiosk_order_mode);
  const [phoneOn, setPhoneOn] = useState(settings.phone_ordering_enabled);
  const [savingManual, setSavingManual] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const isSalon = vertical === 'salon';

  async function togglePhone(next: boolean) {
    setPhoneOn(next);
    setSavingPhone(true);
    const res = await updateAdminKioskSettingsAction(workspaceId, {
      phone_ordering_enabled: next,
    });
    setSavingPhone(false);
    if (res?.error) {
      setPhoneOn(!next);
      toast.error(res.error);
    } else {
      toast.success(next ? 'Phone (QR) ordering enabled' : 'Phone ordering disabled');
    }
  }

  async function toggleManual(next: boolean) {
    setManualOn(next);
    setSavingManual(true);
    const res = await updateAdminKioskSettingsAction(workspaceId, {
      manual_ordering_enabled: next,
    });
    setSavingManual(false);
    if (res?.error) {
      setManualOn(!next); // revert on failure
      toast.error(res.error);
    } else {
      toast.success(next ? 'Manual ordering enabled' : 'Manual ordering disabled');
    }
  }

  async function changeMode(next: 'voice' | 'manual' | 'both') {
    const prev = mode;
    setMode(next);
    setSavingManual(true);
    const res = await updateAdminKioskSettingsAction(workspaceId, { kiosk_order_mode: next });
    setSavingManual(false);
    if (res?.error) {
      setMode(prev);
      toast.error(res.error);
    } else {
      toast.success('Kiosk mode updated');
    }
  }

  const MODE_LABELS: Record<'voice' | 'manual' | 'both', string> = {
    voice: 'Voice only',
    manual: 'Manual only',
    both: 'Both (voice + switch)',
  };

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

        <div className="space-y-2 border-t pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="manual-ordering">Tap-to-order (manual mode)</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isSalon
                  ? 'Restaurant kiosks only — not available for salon workspaces.'
                  : 'Adds a button on the kiosk letting customers order by tapping the menu, alongside voice. Manual orders are free (no credit used).'}
              </p>
            </div>
            <Switch
              id="manual-ordering"
              checked={manualOn}
              onChange={(e) => toggleManual(e.target.checked)}
              disabled={isSalon || savingManual}
            />
          </div>

          {manualOn && !isSalon && (
            <div className="mt-3 space-y-1.5 rounded-lg border bg-muted/40 p-3">
              <Label htmlFor="kiosk-mode">Kiosk mode</Label>
              <p className="text-xs text-muted-foreground">
                What the customer sees. <strong>Voice only</strong>: no tap button.{' '}
                <strong>Manual only</strong>: opens straight to the tap menu, no voice.{' '}
                <strong>Both</strong>: voice with a switch button.
              </p>
              <div className="flex gap-1.5 pt-1">
                {(['voice', 'manual', 'both'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => changeMode(m)}
                    disabled={savingManual}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      mode === m
                        ? 'border-brand bg-brand text-white'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="phone-ordering">QR / phone ordering</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isSalon
                  ? 'Restaurant workspaces only.'
                  : 'Lets customers scan a QR and order from their own phone (many at once), picking up by order number. Separate from the in-store kiosk. Free — no credit used.'}
              </p>
            </div>
            <Switch
              id="phone-ordering"
              checked={phoneOn}
              onChange={(e) => togglePhone(e.target.checked)}
              disabled={isSalon || savingPhone}
            />
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
