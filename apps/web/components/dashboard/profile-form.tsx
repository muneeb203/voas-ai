'use client';

import { useEffect } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { updateProfileAction, type FormState } from '@/app/actions/settings-action';

interface ProfileFormProps {
  defaultName: string;
  email: string;
}

const INITIAL: FormState = { status: 'idle' };

export function ProfileForm({ defaultName, email }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === 'success') toast.success(state.message ?? 'Saved');
    if (state.status === 'error' && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Full name" htmlFor="fullName" required error={fieldErrors?.fullName}>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultName}
          autoComplete="name"
          disabled={pending}
        />
      </Field>

      <Field label="Email" htmlFor="email" hint="Email is managed by Supabase Auth.">
        <Input id="email" value={email} disabled readOnly />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
