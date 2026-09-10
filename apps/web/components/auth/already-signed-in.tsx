import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getMe } from '@/lib/api/workspaces';

interface AlreadySignedInProps {
  email: string;
}

export async function AlreadySignedIn({ email }: AlreadySignedInProps) {
  try {
    const profile = await getMe();
    if (profile.data?.memberships && profile.data.memberships.length > 0) {
      // Has workspace — redirect to dashboard
      redirect('/dashboard');
    }
  } catch {
    // No workspace or error — show create prompt
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome!</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        as <span className="font-medium text-foreground">{email}</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Let's set up your workspace to get started.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href="/signup">Create workspace</Link>
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
