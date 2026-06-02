'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActionState } from '@/lib/use-action-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateWhatsAppSettingsAction,
  type FormResult,
} from '@/app/actions/whatsapp-action';
import type { WhatsAppSettings, WhatsAppCapabilities } from '@/lib/types';

const INITIAL: FormResult = { error: null };

const SESSION_WINDOWS = [
  { value: '1', label: '1 hour' },
  { value: '6', label: '6 hours' },
  { value: '24', label: '24 hours' },
];

interface WhatsAppSettingsFormProps {
  settings: WhatsAppSettings;
  capabilities: WhatsAppCapabilities;
  disabled?: boolean;
}

export function WhatsAppSettingsForm({
  settings,
  capabilities,
  disabled,
}: WhatsAppSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateWhatsAppSettingsAction,
    INITIAL,
  );
  const fieldErrors = state.fieldErrors;
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state.error && !state.fieldErrors) toast.error(state.error);
      else if (!state.error) toast.success('WhatsApp settings saved');
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
        hint="How the agent should behave on WhatsApp. Your menu is appended automatically, and WhatsApp-specific formatting rules are added on top."
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

        <Field
          label="Session window"
          htmlFor="session_window_hours"
          error={fieldErrors?.session_window_hours}
          hint="How long a chat stays one conversation."
        >
          <Select
            name="session_window_hours"
            defaultValue={String(settings.session_window_hours)}
            disabled={disabled || pending}
          >
            <SelectTrigger id="session_window_hours">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
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
        WhatsApp agent enabled (incoming messages answered)
      </label>

      <Button type="submit" disabled={disabled || pending}>
        {pending ? 'Saving…' : 'Save settings'}
      </Button>

      {disabled && (
        <p className="text-xs text-muted-foreground">
          Only workspace owners can edit WhatsApp settings.
        </p>
      )}
    </form>
  );
}
