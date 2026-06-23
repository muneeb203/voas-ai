'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { updateAdminKioskSettingsAction } from '@/app/actions/admin-action';
import type { AdminKioskSettings } from '@/lib/api/admin';

interface AdminKioskSettingsCardProps {
  workspaceId: string;
  settings: AdminKioskSettings;
}

export function AdminKioskSettingsCard({ workspaceId, settings }: AdminKioskSettingsCardProps) {
  const [enabled, setEnabled] = useState(settings.kiosk_enabled);
  const [maxUrls, setMaxUrls] = useState(settings.max_kiosk_urls);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateAdminKioskSettingsAction(workspaceId, {
      kiosk_enabled: enabled,
      max_kiosk_urls: maxUrls,
    });
    setSaving(false);
    if (res?.error) toast.error(res.error);
    else toast.success('Kiosk settings updated');
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
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="kiosk-enabled" className="text-sm font-medium">
              Kiosk enabled
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When off, all kiosk URLs return an error immediately.
            </p>
          </div>
          <Switch id="kiosk-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-urls">Max kiosk URLs (1–10)</Label>
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

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
