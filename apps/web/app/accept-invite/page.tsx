import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lookupInvitation } from '@/lib/api/members';
import { isApiError } from '@/lib/types';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { AcceptInviteForm } from './accept-form';

export const metadata: Metadata = {
  title: 'Accept invitation',
};

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
          <AlertTriangle className="h-6 w-6 text-error" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  if (!token) return <NotFound message="Missing invitation token." />;

  const lookup = await lookupInvitation(token);
  if (isApiError(lookup)) {
    return <NotFound message={lookup.error.message} />;
  }
  const invite = lookup.data;

  if (invite.accepted_at) {
    return <NotFound message="This invitation has already been accepted." />;
  }
  if (new Date(invite.expires_at) < new Date()) {
    return <NotFound message="This invitation has expired. Ask the inviter for a new one." />;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/signup?next=${encodeURIComponent(`/accept-invite?token=${token}`)}` +
        `&email=${encodeURIComponent(invite.email)}`,
    );
  }

  const emailMatches = (user.email ?? '').toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="container flex h-16 items-center">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 className="h-6 w-6 text-accent" />
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Join {invite.workspace_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're invited as a <strong className="text-foreground">{invite.role}</strong>.
          </p>

          {!emailMatches && (
            <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-left text-xs text-warning">
              This invitation was sent to <strong>{invite.email}</strong>, but you're signed in as{' '}
              <strong>{user.email}</strong>. Sign out and sign in with the invited email to accept.
            </div>
          )}

          <div className="mt-8 space-y-2">
            <AcceptInviteForm token={token} disabled={!emailMatches} />
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
                Use a different account
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
