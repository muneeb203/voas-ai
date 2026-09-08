import type { Metadata } from ‘next’;
import { redirect } from ‘next/navigation’;
import { createSupabaseServerClient } from ‘@/lib/supabase/server’;
import { skipOnboarding } from ‘@/app/actions/onboarding-action’;

export const metadata: Metadata = {
  title: ‘Welcome’,
  description: ‘Set up your VOAS AI workspace.’,
};

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(‘/login?next=/onboarding’);

  const { data: memberships } = await supabase
    .from(‘workspace_members’)
    .select(‘workspace_id’)
    .eq(‘user_id’, user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect(‘/dashboard’);
  }

  const fullName: string | undefined =
    typeof user.user_metadata?.full_name === ‘string’ ? user.user_metadata.full_name : undefined;
  const workspaceName = fullName ? `${fullName.split(‘ ‘)[0]}’s practice` : ‘My practice’;

  await skipOnboarding(workspaceName, ‘law’);

  return null;
}
