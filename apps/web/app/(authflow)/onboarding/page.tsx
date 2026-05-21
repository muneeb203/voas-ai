import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Logo } from '@/components/shared/logo';
import { OnboardingWizard } from '@/components/dashboard/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Set up your VOAS AI workspace.',
};

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/onboarding');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect('/dashboard');
  }

  const fullName: string | undefined =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined;
  const defaultName = fullName ? `${fullName.split(' ')[0]}’s business` : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="container flex h-16 items-center justify-between">
        <Logo />
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-xl">
          <div className="mb-6 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
              Welcome to VOAS AI
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Let’s set up your workspace
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Three quick steps — under a minute.
            </p>
          </div>

          <OnboardingWizard defaultName={defaultName} />

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Need help?{' '}
            <Link href="/contact" className="hover:text-foreground">
              Contact us
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
