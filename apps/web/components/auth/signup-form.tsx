'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoogleButton } from './google-button';
import { Turnstile, TURNSTILE_ENABLED } from './turnstile';

const SignupSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name').max(120),
  email: z.string().email('Enter a valid email').max(254),
  password: z.string().min(8, 'At least 8 characters'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof SignupSchema>, string>>;

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') ?? undefined;
  const next = searchParams.get('next') ?? '/onboarding';

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = SignupSchema.safeParse({
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
      password: String(formData.get('password') ?? ''),
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    if (TURNSTILE_ENABLED && !captchaToken) {
      toast.error('Please complete the verification.');
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          plan_intent: plan,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        ...(TURNSTILE_ENABLED ? { captchaToken } : {}),
      },
    });
    setPending(false);

    if (error) {
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
      toast.error(error.message);
      return;
    }

    if (data.user && !data.session) {
      router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
      return;
    }

    router.refresh();
    router.push(next);
  }

  return (
    <div className="space-y-4">
      <GoogleButton next={next} label="Sign up with Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or sign up with email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" required disabled={pending} />
        </Field>

        <Field label="Work email" htmlFor="email" required error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          hint="At least 8 characters."
          error={errors.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
          />
        </Field>

        <Turnstile onVerify={setCaptchaToken} resetSignal={captchaReset} />

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{' '}
          <Link href="/legal/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
