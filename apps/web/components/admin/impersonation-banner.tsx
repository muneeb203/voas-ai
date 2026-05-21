'use client';

import { ShieldAlert } from 'lucide-react';
import { exitImpersonationAction } from '@/app/actions/admin-action';

interface ImpersonationBannerProps {
  workspaceName: string;
}

export function ImpersonationBanner({ workspaceName }: ImpersonationBannerProps) {
  return (
    <div className="bg-error text-white">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>
            Impersonating <strong>{workspaceName}</strong> · Every action is logged.
          </span>
        </div>
        <form action={exitImpersonationAction}>
          <button
            type="submit"
            className="rounded-md bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  );
}
