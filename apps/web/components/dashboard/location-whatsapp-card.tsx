'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import {
  disableLocationWhatsAppAction,
  upsertLocationWhatsAppAction,
} from '@/app/actions/whatsapp-action';
import type { LocationWhatsAppConfigSafe } from '@/lib/types';

interface LocationWhatsAppCardProps {
  locationId: string;
  locationName: string;
  existing: LocationWhatsAppConfigSafe | null;
  sandboxNumber: string;
  disabled?: boolean;
}

export function LocationWhatsAppCard({
  locationId,
  locationName,
  existing,
  sandboxNumber,
  disabled,
}: LocationWhatsAppCardProps) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    const res = await upsertLocationWhatsAppAction(locationId, {
      twilio_account_sid: String(form.get('twilio_account_sid') ?? '').trim(),
      twilio_auth_token: String(form.get('twilio_auth_token') ?? '').trim(),
      twilio_whatsapp_number: String(form.get('twilio_whatsapp_number') ?? '').trim(),
      enabled: form.get('enabled') === 'on',
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('WhatsApp configured for this location');
    setEditing(false);
  }

  async function onDisable() {
    if (!confirm('Remove WhatsApp config for this location?')) return;
    setRemoving(true);
    const res = await disableLocationWhatsAppAction(locationId);
    setRemoving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success('WhatsApp disabled');
      setEditing(false);
    }
  }

  const status = existing
    ? existing.enabled
      ? { label: 'On', variant: 'success' as const }
      : { label: 'Off', variant: 'secondary' as const }
    : { label: 'Not configured', variant: 'secondary' as const };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold">{locationName}</p>
              {existing ? (
                <p className="font-mono text-xs text-muted-foreground">
                  {existing.twilio_whatsapp_number}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No WhatsApp number yet</p>
              )}
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {editing ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Twilio Account SID" htmlFor={`sid-${locationId}`} required>
              <Input
                id={`sid-${locationId}`}
                name="twilio_account_sid"
                defaultValue={existing?.twilio_account_sid ?? ''}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                disabled={pending}
              />
            </Field>

            <Field
              label="Twilio Auth Token"
              htmlFor={`token-${locationId}`}
              required={!existing}
              hint={
                existing
                  ? `Current: ${existing.twilio_auth_token_masked} — paste again only if changing.`
                  : undefined
              }
            >
              <Input
                id={`token-${locationId}`}
                name="twilio_auth_token"
                type="password"
                defaultValue=""
                placeholder={existing ? '••••••• (unchanged)' : 'Paste from Twilio console'}
                required={!existing}
                disabled={pending}
              />
            </Field>

            <Field
              label="WhatsApp number"
              htmlFor={`number-${locationId}`}
              required
              hint={`E.164 format. Sandbox testing uses the shared number ${sandboxNumber}.`}
            >
              <Input
                id={`number-${locationId}`}
                name="twilio_whatsapp_number"
                defaultValue={existing?.twilio_whatsapp_number ?? sandboxNumber}
                placeholder={sandboxNumber}
                required
                disabled={pending}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={existing ? existing.enabled : true}
                className="h-4 w-4 rounded border-input"
                disabled={pending}
              />
              Answer incoming WhatsApp messages on this number
            </label>

            <div className="flex items-center justify-between">
              {existing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDisable}
                  disabled={removing}
                  className="text-error hover:text-error"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : existing ? 'Save changes' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <Button
            variant={existing ? 'outline' : 'default'}
            onClick={() => setEditing(true)}
            disabled={disabled}
            className="w-full"
          >
            {existing ? 'Edit WhatsApp config' : 'Configure WhatsApp'}
          </Button>
        )}

        {disabled && !editing && (
          <p className="text-xs text-muted-foreground">
            Only workspace owners can configure WhatsApp.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
