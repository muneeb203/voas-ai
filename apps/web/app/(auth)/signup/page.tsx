import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SignupForm } from '@/components/auth/signup-form';
import { AlreadySignedIn } from '@/components/auth/already-signed-in';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Get a VOAS AI front desk on your business in minutes.',
};

export default async function SignupPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return <AlreadySignedIn email={user.email ?? 'your account'} />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Start your free workspace. No credit card required.
      </p>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SignupForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
