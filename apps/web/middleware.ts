import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/',
  '/product',
  '/pricing',
  '/contact',
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
];

const DASHBOARD_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/conversations',
  '/orders',
  '/knowledge-base',
  '/integrations',
  '/analytics',
  '/team',
  '/settings',
  '/support',
];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return false;
}

function isDashboard(pathname: string) {
  return DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdmin(pathname: string) {
  return pathname.startsWith('/admin') && pathname !== '/admin/login';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (isDashboard(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin(pathname)) {
    const isAdminUser = user?.app_metadata?.is_admin === true;
    if (!isAdminUser) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  void isPublic;
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
  ],
};
