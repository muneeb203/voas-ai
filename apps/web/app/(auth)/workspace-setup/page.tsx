import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Set up workspace',
  description: 'Create your workspace to get started.',
};

export default async function WorkspaceSetupPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create your first workspace to get started with VOAS AI.
      </p>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SignupForm />
        </Suspense>
      </div>

      <div className="mt-6 text-center">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign out and use a different account
          </button>
        </form>
      </div>
    </div>
  );
}
