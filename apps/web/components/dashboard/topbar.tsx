'use client';

import { useState } from 'react';
import { Menu, X, Bell, ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from './sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface TopbarProps {
  workspaceName: string;
  workspacePlan: string;
  userEmail: string | null;
  userName: string | null;
  role: string;
}

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Topbar({
  workspaceName,
  workspacePlan,
  userEmail,
  userName,
  role,
}: TopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium sm:inline">{workspaceName}</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {workspacePlan}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-muted">
                <Avatar>
                  <AvatarFallback>{initials(userName, userEmail)}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {userName ?? userEmail ?? 'Signed in'}
                  </p>
                  {userEmail && userName && (
                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Role: {role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild destructive>
                <form action="/auth/signout" method="post" className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-background shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-medium">{workspaceName}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar className="h-[calc(100%-4rem)]" onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
