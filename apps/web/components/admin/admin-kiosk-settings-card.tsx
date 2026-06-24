'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { updateAdminKioskSettingsAction, topupKioskCreditsAction } from '@/app/actions/admin-action';
import type { AdminKioskSettings } from '@/lib/api/admin';
import { PLANS } from '@/lib/constants';

interface AdminKioskSettingsCardProps {
  workspaceId: string;
  settings: AdminKioskSettings;
  plan?: string;
}

export function AdminKioskSettingsCard({ workspaceId, settings, plan }: AdminKioskSettingsCardProps) {
  const [enabled, setEnabled] = useState(settings.kiosk_enabled);
  const [maxUrls, setMaxUrls] = useState(settings.max_kiosk_urls);
  const [monthlyLimit, setMonthlyLimit] = useState(settings.kiosk_monthly_limit);
  const [topupAmount, setTopupAmount] = useState(100);
  const [saving, setSaving] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const planDefault = PLANS.find((p) => p.id === plan)?.maxKioskUrls;

  const balance = settings.kiosk_credits_balance;
  const used = settings.kiosk_credits_used_this_month;
  const limit = settings.kiosk_monthly_limit;
  const isUnlimited = limit === 0;
  const usagePct = !isUnlimited && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isAtLimit = !isUnlimited && balance <= 0;
  const isNearLimit = !isUnlimited && limit > 0 && used >= limit * 0.8 && !isAtLimit;

  async function handleSave() {
    setSaving(true);
    const res = await updateAdminKioskSettingsAction(workspaceId, {
      kiosk_enabled: enabled,
      max_kiosk_urls: maxUrls,
      kiosk_monthly_limit: monthlyLimit,
    });
    setSaving(false);
    if (res?.error) toast.error(res.error);
    else toast.success('Kiosk settings updated');
  }

  async function handleTopup() {
    if (topupAmount < 1) return;
    setToppingUp(true);
    const res = await topupKioskCreditsAction(workspaceId, topupAmount);
    setToppingUp(false);
    if (res?.error) toast.error(res.error);
    else toast.success(`Added ${topupAmount} credits to balance`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiosk Access</CardTitle>
        <CardDescription>
          Control whether this workspace can use the self-order kiosk and how many URLs they may
          generate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable / disable */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="kiosk-enabled" className="text-sm font-medium">
              Kiosk enabled
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When off, all kiosk URLs return an error immediately.
            </p>
          </div>
          <Switch id="kiosk-enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </div>

        {/* Max URLs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="max-urls">Max kiosk URLs (1–10)</Label>
            {planDefault !== undefined && planDefault !== maxUrls && (
              <button
                type="button"
                onClick={() => setMaxUrls(planDefault)}
                className="text-xs text-accent-700 hover:underline"
              >
                Set to plan default ({planDefault})
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            When lowered, the oldest excess active URLs are disabled immediately.
          </p>
          <Input
            id="max-urls"
            type="number"
            min={1}
            max={10}
            value={maxUrls}
            onChange={(e) =>
              setMaxUrls(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))
            }
            className="w-24"
          />
        </div>

        {/* Monthly interaction limit */}
        <div className="space-y-2">
          <Label htmlFor="monthly-limit">Monthly interaction limit</Label>
          <p className="text-xs text-muted-foreground">
            Set to 0 for unlimited (Enterprise). Credits roll over indefinitely; balance is topped
            up on the subscription anniversary.
          </p>
          <Input
            id="monthly-limit"
            type="number"
            min={0}
            max={100000}
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-32"
          />
          {monthlyLimit === 0 && (
            <p className="text-xs text-emerald-600 font-medium">Unlimited — no credit checks.</p>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>

        {/* Credit balance & usage */}
        <div className="border-t pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Credit balance</p>
            <div className="flex items-center gap-2">
              {isUnlimited ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                  Unlimited
                </Badge>
              ) : (
                <>
                  {isAtLimit && (
                    <Badge variant="destructive">Limit reached</Badge>
                  )}
                  {isNearLimit && !isAtLimit && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      80%+ used
                    </Badge>
                  )}
                  <span className="text-sm tabular-nums font-semibold">
                    {balance.toLocaleString()} credits remaining
                  </span>
                </>
              )}
            </div>
          </div>

          {!isUnlimited && limit > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>This month: {used.toLocaleString()} / {limit.toLocaleString()} used</span>
                <span>{usagePct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isAtLimit
                      ? 'bg-destructive'
                      : isNearLimit
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              {settings.kiosk_month_start && (
                <p className="text-xs text-muted-foreground">
                  Billing cycle started:{' '}
                  {new Date(settings.kiosk_month_start).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Manual top-up */}
          {!isUnlimited && (
            <div className="space-y-2">
              <Label htmlFor="topup-amount">Add credits (one-time bonus)</Label>
              <p className="text-xs text-muted-foreground">
                Credits are added instantly and roll over indefinitely.
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
                <Button
                  variant="outline"
                  onClick={handleTopup}
                  disabled={toppingUp}
                >
                  {toppingUp ? 'Adding…' : 'Add credits'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
