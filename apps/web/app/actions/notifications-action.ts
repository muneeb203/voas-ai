'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';
import { requireAdminSession } from '@/lib/auth/admin';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import { isApiError, type NotificationList } from '@/lib/types';

export async function fetchNotificationsAction(): Promise<
  { data: NotificationList } | { error: string }
> {
  await requireDashboardSession('/dashboard');
  const res = await listNotifications();
  if (isApiError(res)) {
    return { error: res.error.message };
  }
  return { data: res.data };
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ error: string | null }> {
  await requireDashboardSession('/dashboard');
  const res = await markNotificationRead(notificationId);
  if (isApiError(res)) {
    return { error: res.error.message };
  }
  return { error: null };
}

export async function markAllNotificationsReadAction(): Promise<{ error: string | null }> {
  await requireDashboardSession('/dashboard');
  const res = await markAllNotificationsRead();
  if (isApiError(res)) {
    return { error: res.error.message };
  }
  return { error: null };
}

// --- Admin variants: same notifications table, admin-session gated ----------

export async function fetchAdminNotificationsAction(): Promise<
  { data: NotificationList } | { error: string }
> {
  await requireAdminSession('/admin/workspaces');
  const res = await listNotifications();
  if (isApiError(res)) return { error: res.error.message };
  return { data: res.data };
}

export async function markAdminNotificationReadAction(
  notificationId: string,
): Promise<{ error: string | null }> {
  await requireAdminSession('/admin/workspaces');
  const res = await markNotificationRead(notificationId);
  if (isApiError(res)) return { error: res.error.message };
  return { error: null };
}

export async function markAllAdminNotificationsReadAction(): Promise<{ error: string | null }> {
  await requireAdminSession('/admin/workspaces');
  const res = await markAllNotificationsRead();
  if (isApiError(res)) return { error: res.error.message };
  return { error: null };
}
