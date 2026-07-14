'use client';

import { useState } from 'react';
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
import { updateWorkspaceAction, type FormState } from '@/app/actions/settings-action';

interface WorkspaceFormProps {
  defaultName: string;
  defaultVertical: string;
  slug: string;
  disabled?: boolean;
}

const IDLE: FormState = { status: 'idle' };

export function WorkspaceForm({
  defaultName,
  defaultVertical,
  slug,
  disabled,
}: WorkspaceFormProps) {
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setFieldErrors(undefined);
    setPending(true);
    // Loading widget → resolves to "saved" on the same toast, so the
    // confirmation is reliable even though the action revalidates the layout.
    const toastId = toast.loading('Updating changes…');

    const result = await updateWorkspaceAction(IDLE, formData);
    setPending(false);

    if (result.status === 'success') {
      toast.success('Changes saved', { id: toastId });
    } else if (result.status === 'error') {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message, { id: toastId });
    } else {
      toast.dismiss(toastId);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
        {pending ? 'Updating…' : 'Save changes'}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground">Only workspace owners can edit these.</p>
      )}
    </form>
  );
}
