'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { getMe } from '@/lib/api/workspaces';

interface AlreadySignedInProps {
  email: string;
}

export function AlreadySignedIn({ email }: AlreadySignedInProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasWorkspace, setHasWorkspace] = useState(false);

  useEffect(() => {
    async function checkWorkspace() {
      try {
        const profile = await getMe();
        if (profile.data?.memberships && profile.data.memberships.length > 0) {
          setHasWorkspace(true);
          // Auto-redirect to dashboard if they have a workspace
          router.push('/dashboard');
        }
      } catch {
        // Error means no workspace
        setHasWorkspace(false);
      } finally {
        setLoading(false);
      }
    }

    checkWorkspace();
  }, [router]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!hasWorkspace) {
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

  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  );
}
