'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Loader2 } from 'lucide-react';
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions/notifications-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

// Realtime is the primary signal; this is a slow safety net if the socket drops.
const POLL_MS = 120_000;

function typeLabel(type: Notification['type']): string {
  switch (type) {
    case 'order_placed':
      return 'Order';
    case 'ticket_reply':
    case 'ticket_resolved':
    case 'admin_ticket':
      return 'Ticket';
    case 'kiosk_low':
      return 'Kiosk';
    case 'appointment_booked':
      return 'Booking';
    case 'usage_limit':
    case 'admin_limit':
      return 'Limit';
    case 'admin_signup':
      return 'Signup';
    case 'admin_error':
      return 'Error';
    default:
      return 'Update';
  }
}

interface NotificationBellProps {
  fetchAction?: typeof fetchNotificationsAction;
  markReadAction?: typeof markNotificationReadAction;
  markAllReadAction?: typeof markAllNotificationsReadAction;
}

export function NotificationBell({
  fetchAction = fetchNotificationsAction,
  markReadAction = markNotificationReadAction,
  markAllReadAction = markAllNotificationsReadAction,
}: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetchAction();
    if ('data' in res && res.data) {
      setItems(res.data.items);
      setUnreadCount(res.data.unread_count);
    }
    setLoading(false);
  }, [fetchAction]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Realtime: a new notification row for this user pushes an instant refresh —
  // no waiting on the slow poll. RLS scopes the stream to the user's own rows.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => void refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  function handleMarkAllRead() {
    // Snapshot in case we need to revert.
    const previousItems = items;
    const previousUnread = unreadCount;

    // Optimistic: flip every item to read + zero the badge immediately so the
    // user sees feedback without waiting for the round-trip. If the server
    // call fails, we revert below.
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);

    startTransition(async () => {
      const result = await markAllReadAction();
      if (result.error) {
        // Revert the optimistic update on failure.
        setItems(previousItems);
        setUnreadCount(previousUnread);
        return;
      }
      // Re-fetch to reconcile (server has authoritative state).
      await refresh();
    });
  }

  function handleItemClick(notification: Notification) {
    const wasUnread = !notification.read_at;
    if (wasUnread) {
      // Optimistic single-item read flip + badge decrement.
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_at: now } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    startTransition(async () => {
      if (wasUnread) {
        await markReadAction(notification.id);
      }
      await refresh();
      setOpen(false);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              disabled={pending}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No notifications yet. New orders and VOAS updates will show here.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((n) => {
              const inner = (
                <div
                  className={cn(
                    'flex flex-col gap-1 px-3 py-2.5',
                    !n.read_at && 'bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {typeLabel(n.type)}
                    </Badge>
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              );

              if (n.link) {
                const isExternal = n.link.startsWith('http://') || n.link.startsWith('https://');
                if (isExternal) {
                  return (
                    <DropdownMenuItem key={n.id} asChild className="cursor-pointer p-0">
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleItemClick(n)}
                      >
                        {inner}
                      </a>
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuItem key={n.id} asChild className="cursor-pointer p-0">
                    <Link href={n.link} onClick={() => handleItemClick(n)}>
                      {inner}
                    </Link>
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuItem
                  key={n.id}
                  className="cursor-pointer p-0"
                  onClick={() => handleItemClick(n)}
                >
                  {inner}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
