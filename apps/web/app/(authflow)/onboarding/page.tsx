import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Setting up workspace',
};

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/onboarding');
  }

  // Check if user already has workspace
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect('/dashboard');
  }

  // Create workspace via admin (server-side)
  try {
    const adminClient = createSupabaseAdminClient();

    const fullName = typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : '';
    const workspaceName = fullName ? `${fullName.split(' ')[0]}'s practice` : 'My practice';

    // Create workspace
    const wsRes = await adminClient.table('workspaces').insert({
      name: workspaceName,
      slug: `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`.slice(0, 60),
      vertical: 'law',
      plan: 'trial',
    }).select().single();

    if (wsRes.data) {
      const workspaceId = wsRes.data.id;

      // Add user as owner
      await adminClient.table('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Workspace creation error:', error);
  }

  redirect('/dashboard');
}
