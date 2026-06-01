'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoogleButton } from './google-button';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email').max(254),
  password: z.string().min(1, 'Enter your password'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof LoginSchema>, string>>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const errorParam = searchParams.get('error');

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Surface OAuth / callback errors that landed back here as ?error=...
  useEffect(() => {
    if (errorParam) {
      toast.error(decodeURIComponent(errorParam));
    }
  }, [errorParam]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = LoginSchema.safeParse({
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

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      setPending(false);
      toast.error(error.message);
      return;
    }

    // router.refresh() before push so the server-rendered dashboard layout
    // sees the freshly-set session cookie. Leave pending true through the
    // navigation so the button stays disabled until the new page paints.
    router.refresh();
    router.push(next);
  }

  return (
    <div className="space-y-4">
      <GoogleButton next={next} label="Continue with Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" required error={errors.email}>
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

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
