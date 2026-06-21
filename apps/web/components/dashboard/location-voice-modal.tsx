'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
import { FieldHelp } from '@/components/ui/field-help';
import {
  disableLocationVoiceAction,
  testLocationVoiceAction,
  upsertLocationVoiceAction,
} from '@/app/actions/voice-action';
import type { LocationVoiceConfigSafe } from '@/lib/types';

const SID_HELP = {
  title: 'Where to find your Account SID',
  steps: [
    'Go to console.twilio.com and sign in to your account.',
    'On the dashboard home, look for the "Account Info" box (usually bottom-left).',
    'Copy the string starting with "AC" — that is your Account SID.',
    'Paste it in this field.',
  ],
};

const TOKEN_HELP = {
  title: 'Where to find your Auth Token',
  steps: [
    'Go to console.twilio.com and sign in.',
    'On the dashboard home, find the "Account Info" box.',
    'Click the eye icon next to the Auth Token to reveal it.',
    'Copy and paste it here. We encrypt it server-side and never expose it again.',
  ],
};

const PHONE_HELP = {
  title: 'Finding and formatting your phone number',
  steps: [
    'In the Twilio console, go to Phone Numbers → Manage → Active numbers.',
    'If you have no numbers yet, click "Buy a number" and pick one (around $1/month).',
    'Copy the number exactly as shown — it must start with + followed by the country code, e.g. +14155551234.',
    'For US numbers: +1 then your 10-digit number. The + sign is required.',
  ],
};

interface LocationVoiceModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationId: string;
  locationName: string;
  existing: LocationVoiceConfigSafe | null;
}

type TestState = 'idle' | 'loading' | 'ok' | 'fail';

export function LocationVoiceModal({
  open,
  onOpenChange,
  locationId,
  locationName,
  existing,
}: LocationVoiceModalProps) {
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setTestState('idle');
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

  async function onTestConnection() {
    setTestState('loading');
    setTestMessage('');
    const res = await testLocationVoiceAction(locationId);
    setTestState(res.ok ? 'ok' : 'fail');
    setTestMessage(res.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voice for {locationName}</DialogTitle>
          <DialogDescription>
            Bring your own Twilio number. Auth token stays on the server — we never send it back to
            the browser.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Twilio Account SID"
            htmlFor="twilio_account_sid"
            required
            help={<FieldHelp title={SID_HELP.title} steps={SID_HELP.steps} />}
          >
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
            help={<FieldHelp title={TOKEN_HELP.title} steps={TOKEN_HELP.steps} />}
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
            help={<FieldHelp title={PHONE_HELP.title} steps={PHONE_HELP.steps} />}
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

          {existing && (
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Verify that your Twilio credentials are still valid.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onTestConnection}
                  disabled={testState === 'loading'}
                  className="shrink-0"
                >
                  {testState === 'loading' ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Testing…
                    </>
                  ) : (
                    'Test connection'
                  )}
                </Button>
              </div>
              {testState !== 'idle' && testState !== 'loading' && (
                <div
                  className={`mt-2 flex items-start gap-1.5 text-xs ${
                    testState === 'ok' ? 'text-success' : 'text-error'
                  }`}
                >
                  {testState === 'ok' ? (
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span>{testMessage}</span>
                </div>
              )}
            </div>
          )}

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
