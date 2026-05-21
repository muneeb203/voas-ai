import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFetch as rawApiFetch } from '@/lib/api';
import type { ApiResponse } from '@/lib/types';

interface AuthedFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  idempotencyKey?: string;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
}

/**
 * Server-side fetcher to FastAPI that auto-injects the current user's
 * Supabase JWT from the request cookies. Use from Server Components
 * (`await getAuthedSession(); apiCall(...)`) and Server Actions.
 *
 * On 204 No Content, returns `{ data: null as T }`.
 */
export async function apiCall<T>(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<ApiResponse<T>> {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'No active session',
      },
    };
  }

  return rawApiFetch<T>(path, {
    method: options.method ?? 'GET',
    body: options.body,
    idempotencyKey: options.idempotencyKey,
    token: session.access_token,
    cache: options.cache,
    next: options.next,
  });
}
