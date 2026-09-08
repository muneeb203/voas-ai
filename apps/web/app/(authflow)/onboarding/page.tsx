import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Setting up workspace',
};

async function createLawWorkspace(userId: string, fullName?: string) {
  'use server';

  const supabase = createSupabaseServerClient();

  try {
    const workspaceName = fullName ? `${fullName.split(' ')[0]}'s practice` : 'My practice';
    const slug = `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`.slice(0, 60);

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug,
        vertical: 'law',
        plan: 'trial',
      })
      .select()
      .single();

    if (wsError || !workspace) {
      console.error('Workspace creation error:', wsError);
      return false;
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Workspace creation error:', error);
    return false;
  }
}

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

  // Create workspace
  const fullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : undefined;

  await createLawWorkspace(user.id, fullName);

  redirect('/dashboard');
}
