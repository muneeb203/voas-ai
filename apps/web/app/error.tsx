'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-error">Something went wrong</p>
      <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">
        We hit an unexpected error
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        The error has been logged. Try again, or head back home.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
