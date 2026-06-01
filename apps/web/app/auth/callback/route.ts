import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/auth/public-origin';

/** Only allow same-origin relative paths after OAuth (blocks open redirects). */
function safeNextPath(raw: string | null): string {
  const next = raw ?? '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

/**
 * Supabase auth callback. Handles:
 *   - Email confirmation links (`?token_hash=...&type=signup`)
 *   - Password recovery links (`?token_hash=...&type=recovery`)
 *   - OAuth code exchange (`?code=...`) for Google sign-in
 *
 * After a successful exchange, redirect to `next` (defaults to /dashboard).
 * Uses forwarded-header-aware origin so behind-proxy deploys (DO App Platform)
 * never redirect to the internal localhost listener.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getPublicOrigin(request);
  const supabase = createSupabaseServerClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeNextPath(searchParams.get('next'));

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'recovery' | 'email' | 'invite' | 'email_change',
      token_hash: tokenHash,
    });
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_token`);
}
