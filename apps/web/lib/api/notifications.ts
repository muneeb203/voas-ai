import 'server-only';
import { apiCall } from './client';
import type { Notification, NotificationList } from '@/lib/types';

export function listNotifications(limit = 30) {
  return apiCall<NotificationList>(`/v1/notifications?limit=${limit}`, {
    cache: 'no-store',
  });
}

export function markNotificationRead(notificationId: string) {
  return apiCall<Notification>(`/v1/notifications/${notificationId}/read`, {
    method: 'PATCH',
    cache: 'no-store',
  });
}

export function markAllNotificationsRead() {
  return apiCall<{ marked_read: number }>(`/v1/notifications/read-all`, {
    method: 'POST',
    cache: 'no-store',
  });
}
