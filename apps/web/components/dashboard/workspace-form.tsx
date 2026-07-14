'use client';

import { useEffect } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VERTICALS } from '@/lib/constants';
import {
  updateWorkspaceAction,
  type FormState,
} from '@/app/actions/settings-action';

interface WorkspaceFormProps {
  defaultName: string;
  defaultVertical: string;
  slug: string;
  disabled?: boolean;
}

const INITIAL: FormState = { status: 'idle' };

export function WorkspaceForm({
  defaultName,
  defaultVertical,
  slug,
  disabled,
}: WorkspaceFormProps) {
  const [state, formAction, pending] = useActionState(updateWorkspaceAction, INITIAL);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === 'success') toast.success(state.message ?? 'Saved');
    if (state.status === 'error' && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Workspace name" htmlFor="name" required error={fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={defaultName} disabled={disabled || pending} />
      </Field>

      <Field
        label="Workspace slug"
        htmlFor="slug"
        hint="Auto-generated from name. We don't change it after creation in V1."
      >
        <Input id="slug" value={slug} disabled readOnly />
      </Field>

      <Field
        label="Business type"
        htmlFor="vertical"
        required
        error={fieldErrors?.vertical}
        hint="Switching changes your whole dashboard — e.g. a salon gets Appointments, Services, and Staff instead of Orders and Menu. Restaurant and Salon are fully supported today; more are coming."
      >
        <Select name="vertical" defaultValue={defaultVertical} disabled={disabled || pending}>
          <SelectTrigger id="vertical">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERTICALS.map((v) => (
              <SelectItem key={v.value} value={v.value} disabled={!v.available}>
                {v.label}
                {!v.available ? ' (coming soon)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button type="submit" disabled={disabled || pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground">Only workspace owners can edit these.</p>
      )}
    </form>
  );
}
