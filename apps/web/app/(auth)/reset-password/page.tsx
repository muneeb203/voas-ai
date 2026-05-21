import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set new password',
};

export default function ResetPasswordPage() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose something memorable. At least 8 characters.
      </p>

      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
