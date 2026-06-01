import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/auth/public-origin';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${getPublicOrigin(request)}/login`, { status: 303 });
}
