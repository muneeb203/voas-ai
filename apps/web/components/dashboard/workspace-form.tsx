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
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '@/lib/currency';
import { updateWorkspaceAction, type FormState } from '@/app/actions/settings-action';

interface WorkspaceFormProps {
  defaultName: string;
  defaultCurrency?: string;
  slug: string;
  disabled?: boolean;
}

const IDLE: FormState = { status: 'idle' };

export function WorkspaceForm({
  defaultName,
  defaultCurrency = DEFAULT_CURRENCY,
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
        label="Currency"
        htmlFor="currency"
        error={fieldErrors?.currency}
        hint="Shown on prices across your dashboard, kiosk, receipts, and order messages. Doesn't convert amounts — only changes the symbol."
      >
        <Select name="currency" defaultValue={defaultCurrency} disabled={disabled || pending}>
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.label}
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
