import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/auth/login-form';
import { AlreadySignedIn } from '@/components/auth/already-signed-in';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your VOAS AI dashboard.',
};

export default async function LoginPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return <AlreadySignedIn email={user.email ?? 'your account'} />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to your dashboard.</p>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don’t have an account?{' '}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
