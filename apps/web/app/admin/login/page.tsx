import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { AdminLoginForm } from '@/components/admin/admin-login-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

interface AdminLoginPageProps {
  searchParams: { error?: string };
}

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const error =
    searchParams.error === 'not_admin'
      ? 'That account is not provisioned as an admin.'
      : undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <div className="flex items-center gap-2 text-error">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">VOAS Admin</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">
          For VOAS team members only. All actions are audit-logged.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-error/40 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-8 [&_input]:bg-slate-900 [&_input]:text-slate-100 [&_input]:border-slate-700 [&_label]:text-slate-200">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
