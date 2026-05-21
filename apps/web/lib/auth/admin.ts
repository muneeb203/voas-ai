import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AdminSession {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

type AdminFetchResult =
  | { kind: 'admin'; session: AdminSession }
  | { kind: 'no-user' }
  | { kind: 'not-admin' };

const fetchAdmin = cache(async (): Promise<AdminFetchResult> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: 'no-user' };

  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) return { kind: 'not-admin' };

  const fullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null;

  return {
    kind: 'admin',
    session: {
      user: { id: user.id, email: user.email ?? null, full_name: fullName },
    },
  };
});

/**
 * Server-side guard for /admin/* routes. Redirects to /admin/login if:
 *   - no session, OR
 *   - the session user is not an admin (no app_metadata.is_admin)
 *
 * The middleware also gates /admin/* — this is defense in depth.
 * Cached per-request via React's `cache()` so layout + page share one read.
 */
export async function requireAdminSession(returnTo: string): Promise<AdminSession> {
  const result = await fetchAdmin();
  switch (result.kind) {
    case 'admin':
      return result.session;
    case 'no-user':
      redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
    case 'not-admin':
      redirect(`/admin/login?error=not_admin`);
  }
}
