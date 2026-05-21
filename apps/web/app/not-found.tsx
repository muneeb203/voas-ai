import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Compass className="h-6 w-6 text-accent" />
      </div>
      <p className="mt-6 text-sm font-medium uppercase tracking-wider text-accent">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Page not found</h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        That URL doesn’t belong to anything we host. Try the homepage or your dashboard.
      </p>
      <div className="mt-8 flex gap-2">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
