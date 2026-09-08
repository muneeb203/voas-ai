import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Setting up workspace',
};

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/onboarding');
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect('/dashboard');
  }

  // Auto-create law workspace for new users
  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : '';
  const workspaceName = fullName ? `${fullName.split(' ')[0]}'s practice` : 'My practice';

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      await fetch(`${apiUrl}/v1/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: workspaceName,
          vertical: 'law',
        }),
      });
    }
  } catch (error) {
    console.error('Failed to create workspace:', error);
  }

  redirect('/dashboard');
}
