'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function appOrigin(): string {
  if (typeof window === 'undefined') return '';
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? window.location.origin;
}

interface GoogleButtonProps {
  /**
   * Path to land on after the OAuth round-trip + Supabase callback.
   * If omitted, reads ?next= from the URL, defaulting to /dashboard.
   */
  next?: string;
  /**
   * Visible button label. Different copy on login vs signup feels nicer.
   */
  label?: string;
}

export function GoogleButton({ next, label = 'Continue with Google' }: GoogleButtonProps) {
  const searchParams = useSearchParams();
  const nextPath = next ?? searchParams.get('next') ?? '/dashboard';
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const origin = appOrigin();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      const hint =
        error.message.toLowerCase().includes('provider') ||
        error.message.toLowerCase().includes('google')
          ? ' Enable Google in supabase/.env and restart Supabase (see docs/auth-google-setup.md).'
          : '';
      toast.error(`${error.message}${hint}`);
      setPending(false);
      return;
    }
    // On success, Supabase redirects the browser to Google.
    // We deliberately leave `pending` true so the button stays disabled
    // until the redirect actually happens.
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full gap-2"
      onClick={onClick}
      disabled={pending}
    >
      <GoogleLogo className="h-4 w-4" />
      {pending ? 'Redirecting to Google…' : label}
    </Button>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
