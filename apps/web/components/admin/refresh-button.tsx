'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Re-fetches the current server component without a full browser reload.
 *
 * The admin lists are server-rendered with `cache: 'no-store'`, so a
 * router.refresh() is enough to pull fresh rows — and it keeps scroll position
 * and any open filters, which F5 does not.
 */
export function RefreshButton({ label = 'Refresh' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="gap-2"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} />
      {pending ? 'Refreshing…' : label}
    </Button>
  );
}
