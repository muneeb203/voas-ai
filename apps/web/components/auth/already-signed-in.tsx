import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AlreadySignedInProps {
  email: string;
}

export function AlreadySignedIn({ email }: AlreadySignedInProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">You're already signed in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        as <span className="font-medium text-foreground">{email}</span>
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>

        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Sign out and use a different account
          </Button>
        </form>
      </div>
    </div>
  );
}
