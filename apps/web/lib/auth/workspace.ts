import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/workspaces';
import { isApiError, type CurrentUserProfile, type WorkspaceMembership } from '@/lib/types';
import { readImpersonation, type ImpersonationState } from './impersonation';

export interface DashboardSession {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
  profile: CurrentUserProfile;
  active: WorkspaceMembership;
  impersonation: ImpersonationState | null;
}

type SessionFetchResult =
  | { kind: 'session'; session: DashboardSession }
  | { kind: 'no-user' }
  | { kind: 'no-workspace' }
  | { kind: 'unauthorized' }
  | { kind: 'backend-down'; code: string };

/**
 * The expensive part: read user from cookies + call /v1/me + read impersonation.
 *
 * Wrapped in React's `cache()` so layout + page + sub-fetches in the same
 * request share one network round-trip. Outside one request this caches nothing.
 */
const fetchSession = cache(async (): Promise<SessionFetchResult> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: 'no-user' };

  const res = await getMe();
  if (isApiError(res)) {
    if (res.error.code === 'UNAUTHORIZED') return { kind: 'unauthorized' };
    return { kind: 'backend-down', code: res.error.code };
  }

  const profile = res.data;
  const isAdmin = user.app_metadata?.is_admin === true;
  const impersonation = isAdmin ? readImpersonation() : null;

  let active: WorkspaceMembership;
  if (impersonation) {
    const existing = profile.memberships.find(
      (m) => m.workspace_id === impersonation.workspace_id,
    );
    if (existing) {
      active = existing;
    } else {
      active = {
        workspace_id: impersonation.workspace_id,
        role: 'owner',
        joined_at: null,
        workspace: {
          id: impersonation.workspace_id,
          name: impersonation.workspace_name,
          slug: impersonation.workspace_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-'),
          plan: 'professional',
          vertical: 'restaurant',
          status: 'active',
          created_at: impersonation.started_at,
          updated_at: impersonation.started_at,
        },
      };
    }
  } else {
    if (!profile.memberships.length) return { kind: 'no-workspace' };
    active = profile.memberships[0]!;
  }

  return {
    kind: 'session',
    session: {
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
      },
      profile,
      active,
      impersonation,
    },
  };
});

/**
 * Server-component helper for every dashboard route.
 * - Redirects to /login if not signed in.
 * - Redirects to /onboarding if a regular user has no workspace.
 * - If an admin has an active impersonation cookie, swaps the active
 *   workspace to the impersonation target.
 */
export async function requireDashboardSession(
  redirectPathIfNoSession: string,
): Promise<DashboardSession> {
  const result = await fetchSession();

  switch (result.kind) {
    case 'session':
      return result.session;
    case 'no-user':
    case 'unauthorized':
      redirect(`/login?next=${encodeURIComponent(redirectPathIfNoSession)}`);
    case 'no-workspace':
      redirect('/onboarding');
    case 'backend-down': {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(
        /\/+$/,
        '',
      );
      throw new Error(
        `Could not load your account (${result.code}). Tried API at ${apiUrl}.`,
      );
    }
  }
}
