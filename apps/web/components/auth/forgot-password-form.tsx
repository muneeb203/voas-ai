'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const EmailSchema = z.object({
  email: z.string().email('Enter a valid email').max(254),
});

const OtpSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

type Step = 'email' | 'code';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const parsed = EmailSchema.safeParse({
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
    setPending(false);

    if (resetError) {
      toast.error(resetError.message);
      return;
    }

    setEmail(parsed.data.email);
    setStep('code');
    toast.success('Code sent. Check your email.');
  }

  async function onCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const token = String(formData.get('token') ?? '').trim();
    const parsed = OtpSchema.safeParse({ token });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid code');
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.token,
      type: 'recovery',
    });
    setPending(false);

    if (verifyError) {
      toast.error(verifyError.message);
      return;
    }

    router.push('/reset-password');
    router.refresh();
  }

  async function resendCode() {
    if (!email) return;
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setPending(false);
    if (resetError) toast.error(resetError.message);
    else toast.success('New code sent.');
  }

  if (step === 'code') {
    return (
      <form onSubmit={onCodeSubmit} className="space-y-4" noValidate>
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-muted-foreground">
            We sent a 6-digit code to <strong className="text-foreground">{email}</strong>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            In dev, emails land in Mailpit:{' '}
            <a
              href="http://localhost:54324"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              open inbox
            </a>
          </p>
        </div>

        <Field label="6-digit code" htmlFor="token" required error={error}>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            className="font-mono tracking-[0.4em] text-center text-lg"
            required
            disabled={pending}
            autoFocus
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Verifying…' : 'Verify code'}
        </Button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError(undefined);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onEmailSubmit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" required error={error}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send code'}
      </Button>
    </form>
  );
}
