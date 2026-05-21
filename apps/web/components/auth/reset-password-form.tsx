'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const Schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string().min(8, 'At least 8 characters'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords don’t match',
    path: ['confirm'],
  });

type FieldErrors = Partial<Record<keyof z.infer<typeof Schema>, string>>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = Schema.safeParse({
      password: String(formData.get('password') ?? ''),
      confirm: String(formData.get('confirm') ?? ''),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Password updated.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="New password" htmlFor="password" required error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
