‘use server’;

import { redirect } from ‘next/navigation’;
import { createSupabaseServerClient } from ‘@/lib/supabase/server’;
import { createWorkspace } from ‘@/lib/api/workspaces’;
import { isApiError } from ‘@/lib/types’;

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

  const res = await createWorkspace({
    name: workspaceName,
    vertical: ‘law’,
  });

  if (isApiError(res)) {
    if (res.error.code === ‘CONFLICT’) {
      redirect(‘/dashboard’);
    }
  }

  redirect(‘/dashboard’);
}
