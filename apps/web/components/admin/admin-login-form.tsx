'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Turnstile, TURNSTILE_ENABLED } from '@/components/auth/turnstile';

const Schema = z.object({
  email: z.string().email('Enter a valid email').max(254),
  password: z.string().min(1, 'Enter your password'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof Schema>, string>>;

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/admin/workspaces';

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = Schema.safeParse({
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
      password: String(formData.get('password') ?? ''),
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

    if (TURNSTILE_ENABLED && !captchaToken) {
      toast.error('Please complete the verification.');
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      ...parsed.data,
      options: TURNSTILE_ENABLED ? { captchaToken } : undefined,
    });
    setPending(false);

    if (error) {
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
      toast.error(error.message);
      return;
    }

    // Reject non-admins immediately so they don't see the admin shell.
    if (!data.user?.app_metadata?.is_admin) {
      await supabase.auth.signOut();
      toast.error('That account is not provisioned as an admin.');
      return;
    }

    // 2FA stub: in V1 we skip the TOTP challenge. Sprint 6 wires in pyotp.

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Admin email" htmlFor="email" required error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </Field>

      <Field label="Password" htmlFor="password" required error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </Field>

      <Turnstile onVerify={setCaptchaToken} resetSignal={captchaReset} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in to admin'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Admins are manually provisioned. Talk to a super admin if you need access.
      </p>
    </form>
  );
}
