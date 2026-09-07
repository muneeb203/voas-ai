import 'server-only';
import { apiCall } from './client';

export interface PushConfig {
  configured: boolean;
  public_key: string | null;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function getPushConfig() {
  return apiCall<PushConfig>('/v1/push/config', { cache: 'no-store' });
}

export function subscribePush(payload: PushSubscriptionPayload) {
  return apiCall<{ subscribed: boolean }>('/v1/push/subscribe', {
    method: 'POST',
    body: payload,
    cache: 'no-store',
  });
}

export function unsubscribePush(endpoint: string) {
  return apiCall<{ subscribed: boolean }>('/v1/push/unsubscribe', {
    method: 'POST',
    body: { endpoint },
    cache: 'no-store',
  });
}
