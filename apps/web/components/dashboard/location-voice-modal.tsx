'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import {
  disableLocationVoiceAction,
  upsertLocationVoiceAction,
} from '@/app/actions/voice-action';
import type { LocationVoiceConfigSafe } from '@/lib/types';

interface LocationVoiceModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationId: string;
  locationName: string;
  existing: LocationVoiceConfigSafe | null;
}

export function LocationVoiceModal({
  open,
  onOpenChange,
  locationId,
  locationName,
  existing,
}: LocationVoiceModalProps) {
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    const res = await upsertLocationVoiceAction(locationId, {
      twilio_account_sid: String(form.get('twilio_account_sid') ?? '').trim(),
      twilio_auth_token: String(form.get('twilio_auth_token') ?? '').trim(),
      twilio_phone_number: String(form.get('twilio_phone_number') ?? '').trim(),
      enabled: form.get('enabled') === 'on',
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Voice configured for this location');
    onOpenChange(false);
  }

  async function onDisable() {
    if (!confirm('Disable voice for this location? The phone number will be removed from Vapi.')) {
      return;
    }
    setRemoving(true);
    const res = await disableLocationVoiceAction(locationId);
    setRemoving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Voice disabled');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voice for {locationName}</DialogTitle>
          <DialogDescription>
            Bring your own Twilio number. Auth token stays on the server — we never send it back to the browser.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Twilio Account SID" htmlFor="twilio_account_sid" required>
            <Input
              id="twilio_account_sid"
              name="twilio_account_sid"
              defaultValue={existing?.twilio_account_sid ?? ''}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
              disabled={pending}
            />
          </Field>

          <Field
            label="Twilio Auth Token"
            htmlFor="twilio_auth_token"
            required
            hint={
              existing
                ? `Current: ${existing.twilio_auth_token_masked} — paste again only if changing.`
                : undefined
            }
          >
            <Input
              id="twilio_auth_token"
              name="twilio_auth_token"
              type="password"
              defaultValue=""
              placeholder={existing ? '••••••• (unchanged)' : 'Paste from Twilio console'}
              required={!existing}
              disabled={pending}
            />
          </Field>

          <Field
            label="Phone number"
            htmlFor="twilio_phone_number"
            required
            hint="E.164 format with country code, e.g. +14155551234"
          >
            <Input
              id="twilio_phone_number"
              name="twilio_phone_number"
              defaultValue={existing?.twilio_phone_number ?? ''}
              placeholder="+14155551234"
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
            Answer incoming calls on this number
          </label>

          <DialogFooter className="flex-col sm:flex-row sm:justify-between">
            {existing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onDisable}
                disabled={removing}
                className="text-error hover:text-error"
              >
                {removing ? 'Disabling…' : 'Disable & remove'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : existing ? 'Save changes' : 'Save & import'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
