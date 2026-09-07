'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateAdminPushSettingsAction } from '@/app/actions/admin-action';
import type { AdminPushSettings } from '@/lib/api/admin';

interface AdminPushSettingsCardProps {
  workspaceId: string;
  settings: AdminPushSettings;
}

type EventKey =
  | 'notify_order'
  | 'notify_appointment'
  | 'notify_ticket'
  | 'notify_kiosk_low'
  | 'notify_announcement';

const EVENTS: { key: EventKey; label: string; hint: string }[] = [
  { key: 'notify_order', label: 'New orders', hint: 'Voice, kiosk, QR and WhatsApp orders.' },
  { key: 'notify_appointment', label: 'New bookings', hint: 'Salon/service appointments booked.' },
  { key: 'notify_ticket', label: 'Support replies', hint: 'VOAS replies or resolves their ticket.' },
  { key: 'notify_kiosk_low', label: 'Kiosk credits low', hint: 'Kiosk running low or out of credits.' },
  { key: 'notify_announcement', label: 'VOAS announcements', hint: 'Product updates you broadcast.' },
];

export function AdminPushSettingsCard({ workspaceId, settings }: AdminPushSettingsCardProps) {
  const [state, setState] = useState<AdminPushSettings>(settings);
  const [saving, setSaving] = useState<string | null>(null);

  async function patch(field: keyof AdminPushSettings, value: boolean | string) {
    const prev = state;
    setState({ ...state, [field]: value } as AdminPushSettings);
    setSaving(field);
    const res = await updateAdminPushSettingsAction(workspaceId, { [field]: value });
    setSaving(null);
    if (res?.error) {
      setState(prev); // revert
      toast.error(res.error);
    } else {
      toast.success('Push settings updated');
    }
  }

  const on = state.push_enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
        <CardDescription>
          Controls the OS-level (phone) push for this workspace&apos;s installed app. The in-app
          notification bell is unaffected. Owners still grant permission on their own device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="push-enabled">Push enabled</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Master switch. When off, no push is sent for this workspace.
            </p>
          </div>
          <Switch
            id="push-enabled"
            checked={on}
            onChange={(e) => patch('push_enabled', e.target.checked)}
            disabled={saving === 'push_enabled'}
          />
        </div>

        <div className="space-y-2 border-t pt-5">
          <Label>Who receives push</Label>
          <div className="flex gap-1.5 pt-1">
            {(
              [
                ['owners_managers', 'Owners & managers'],
                ['all', 'All staff'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => patch('recipients', value)}
                disabled={!on || saving === 'recipients'}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  state.recipients === value
                    ? 'border-brand bg-brand text-white'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <Label>Which events push</Label>
          {EVENTS.map((ev) => (
            <div key={ev.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{ev.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{ev.hint}</p>
              </div>
              <Switch
                id={ev.key}
                checked={state[ev.key]}
                onChange={(e) => patch(ev.key, e.target.checked)}
                disabled={!on || saving === ev.key}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
