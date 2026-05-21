import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS. Server-only — never import
 * this into a Client Component. The `server-only` import will refuse to
 * bundle it for the browser as a defense-in-depth check.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
