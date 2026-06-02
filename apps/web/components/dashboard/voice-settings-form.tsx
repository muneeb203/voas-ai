'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActionState } from '@/lib/use-action-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateVoiceSettingsAction,
  type FormResult,
} from '@/app/actions/voice-action';
import type { VoiceSettings, VoiceCapabilities } from '@/lib/types';

const INITIAL: FormResult = { error: null };

interface VoiceSettingsFormProps {
  settings: VoiceSettings;
  capabilities: VoiceCapabilities;
  disabled?: boolean;
}

export function VoiceSettingsForm({
  settings,
  capabilities,
  disabled,
}: VoiceSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateVoiceSettingsAction, INITIAL);
  const fieldErrors = state.fieldErrors;
  const wasPending = useRef(false);

  useEffect(() => {
    // Fire a toast only on the transition from pending → not pending
    // (i.e. the action just finished). This avoids the initial render firing.
    if (wasPending.current && !pending) {
      if (state.error && !state.fieldErrors) toast.error(state.error);
      else if (!state.error) toast.success('Voice settings saved');
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Greeting" htmlFor="greeting" required error={fieldErrors?.greeting}>
        <Input
          id="greeting"
          name="greeting"
          defaultValue={settings.greeting}
          required
          disabled={disabled || pending}
        />
      </Field>

      <Field
        label="System prompt"
        htmlFor="system_prompt"
        required
        error={fieldErrors?.system_prompt}
        hint="What the agent should sound like and do. Your menu is appended automatically."
      >
        <Textarea
          id="system_prompt"
          name="system_prompt"
          rows={10}
          defaultValue={settings.system_prompt}
          required
          disabled={disabled || pending}
          className="font-mono text-xs"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Voice" htmlFor="voice" error={fieldErrors?.voice}>
          <Select name="voice" defaultValue={settings.voice} disabled={disabled || pending}>
            <SelectTrigger id="voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="LLM" htmlFor="model" error={fieldErrors?.model}>
          <Select name="model" defaultValue={settings.model} disabled={disabled || pending}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="h-4 w-4 rounded border-input"
          disabled={disabled || pending}
        />
        Voice agent enabled (incoming calls answered)
      </label>

      <Field label="Order confirmations" htmlFor="send_order_confirmations">
        <div className="flex items-center gap-3">
          <Switch
            id="send_order_confirmations"
            name="send_order_confirmations"
            defaultChecked={settings.send_order_confirmations}
            disabled={disabled || pending}
          />
          <span className="text-sm text-muted-foreground">
            Automatically send a WhatsApp/SMS confirmation after every order
          </span>
        </div>
      </Field>

      <Button type="submit" disabled={disabled || pending}>
        {pending ? 'Saving…' : 'Save & sync to Vapi'}
      </Button>

      {disabled && (
        <p className="text-xs text-muted-foreground">Only workspace owners can edit voice settings.</p>
      )}
    </form>
  );
}
