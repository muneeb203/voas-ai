'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const message = error?.message ?? 'Unexpected error';
  const isBackendDown = message.includes('Could not load your account');

  useEffect(() => {
    // Log to the browser console so it's diagnosable in production without
    // hunting through server logs.
    console.error('[dashboard error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold">
          {isBackendDown ? 'Backend unreachable' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isBackendDown
            ? "We couldn't reach the API. Check that the backend is deployed and that NEXT_PUBLIC_API_URL points to its public URL (no trailing slash)."
            : 'We hit an unexpected error. Try again, or head back home.'}
        </p>
        <p className="mt-3 break-words text-xs text-muted-foreground">
          <span className="font-mono">{message}</span>
          {error?.digest && (
            <>
              {' '}
              <span className="font-mono opacity-60">({error.digest})</span>
            </>
          )}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
