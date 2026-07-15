import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PageErrorCardProps {
  title: string;
  /** The API's message — shown verbatim so the cause isn't a mystery. */
  message: string;
  /** Where "Try again" points. Defaults to the current page via a plain reload link. */
  retryHref?: string;
}

/**
 * Inline error state for a page whose data failed to load.
 *
 * Prefer this over `throw` for expected failures (no access, backend
 * restarting, a 500 from one endpoint): throwing hits the route error boundary,
 * which can only say "something went wrong" — this tells the user what actually
 * happened and how to recover, without taking down the whole page.
 */
export function PageErrorCard({ title, message, retryHref }: PageErrorCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
          <AlertCircle className="h-5 w-5 text-error" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        <div className="mt-1 flex items-center gap-3 text-sm">
          {retryHref && (
            <Link href={retryHref} className="font-medium text-accent underline">
              Try again
            </Link>
          )}
          <Link href="/dashboard" className="text-muted-foreground underline">
            Back to dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
