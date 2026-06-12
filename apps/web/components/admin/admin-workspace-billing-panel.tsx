'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { CreditGrant, CreditType, PlanId, UsageSummary } from '@/lib/types';
import { PLANS } from '@/lib/constants';
import { BillingUsagePanel } from '@/components/dashboard/billing-usage-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  grantWorkspaceCreditsAction,
  updateWorkspaceBillingAction,
} from '@/app/actions/admin-action';

const CREDIT_TYPES: { value: CreditType; label: string }[] = [
  { value: 'voice_minutes', label: 'Voice minutes' },
  { value: 'whatsapp_messages', label: 'WhatsApp messages' },
  { value: 'help_bot_turns', label: 'Help assistant turns' },
];

interface AdminWorkspaceBillingPanelProps {
  workspaceId: string;
  usage: UsageSummary;
  grants: CreditGrant[];
}

export function AdminWorkspaceBillingPanel({
  workspaceId,
  usage,
  grants,
}: AdminWorkspaceBillingPanelProps) {
  const [plan, setPlan] = useState<PlanId>(usage.plan.slug);
  const [enforcementOff, setEnforcementOff] = useState(usage.usage_enforcement_disabled);
  const [creditType, setCreditType] = useState<CreditType>('voice_minutes');
  const [amount, setAmount] = useState('100');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  function saveBilling() {
    startTransition(async () => {
      const res = await updateWorkspaceBillingAction(workspaceId, {
        plan,
        usage_enforcement_disabled: enforcementOff,
      });
      if (res?.error) toast.error(res.error);
      else toast.success('Billing settings updated');
    });
  }

  function grantCredits() {
    const n = parseInt(amount, 10);
    if (!n || n < 1) {
      toast.error('Enter a valid amount');
      return;
    }
    startTransition(async () => {
      const res = await grantWorkspaceCreditsAction(workspaceId, {
        credit_type: creditType,
        amount: n,
        reason: reason.trim() || undefined,
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Credits granted');
        setReason('');
      }
    });
  }

  return (
    <div className="space-y-6">
      <BillingUsagePanel usage={usage} grants={grants} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin controls</CardTitle>
          <CardDescription>Change plan, pause enforcement, or add bonus credits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as PlanId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch
                id="enforcement-off"
                checked={enforcementOff}
                onChange={(e) => setEnforcementOff(e.target.checked)}
              />
              <Label htmlFor="enforcement-off" className="cursor-pointer">
                Pause usage limits (re-enable bots over 100%)
              </Label>
            </div>
          </div>
          <Button onClick={saveBilling} disabled={pending}>
            Save billing settings
          </Button>

          <div className="border-t border-border pt-6">
            <p className="mb-3 text-sm font-medium">Grant bonus credits</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={creditType} onValueChange={(v) => setCreditType(v as CreditType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label>Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <Button variant="secondary" className="mt-3" onClick={grantCredits} disabled={pending}>
              Grant credits
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
