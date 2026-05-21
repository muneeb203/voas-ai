import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Verify your email',
};

interface VerifyEmailPageProps {
  searchParams: { email?: string };
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const email = searchParams.email;

  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <Mail className="h-6 w-6 text-accent" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {email ? (
          <>
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{email}</span>. Click the link in that
            email to finish creating your account.
          </>
        ) : (
          'We sent a confirmation link to your email. Click it to finish creating your account.'
        )}
      </p>

      <p className="mt-6 text-xs text-muted-foreground">
        Didn’t get an email? Check your spam folder, or wait a minute and try signing up again.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <Button asChild variant="outline">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
