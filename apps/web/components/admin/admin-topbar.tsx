'use client';

import { LogOut, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import {
  fetchAdminNotificationsAction,
  markAdminNotificationReadAction,
  markAllAdminNotificationsReadAction,
} from '@/app/actions/notifications-action';

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '?').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

interface AdminTopbarProps {
  userName: string | null;
  userEmail: string | null;
}

export function AdminTopbar({ userName, userEmail }: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 text-slate-100">
      <div className="flex items-center gap-3">
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          Admin
        </Badge>
        <span className="hidden text-sm text-slate-400 sm:inline">
          You are operating across all workspaces.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell
          fetchAction={fetchAdminNotificationsAction}
          markReadAction={markAdminNotificationReadAction}
          markAllReadAction={markAllAdminNotificationsReadAction}
        />
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-white">{userName ?? userEmail}</p>
          {userName && userEmail && (
            <p className="text-xs text-slate-400">{userEmail}</p>
          )}
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-error text-white">
            {initials(userName, userEmail)}
          </AvatarFallback>
        </Avatar>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
