'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  getPushConfig,
  subscribePush,
  unsubscribePush,
  type PushConfig,
  type PushSubscriptionPayload,
} from '@/lib/api/push';
import { isApiError } from '@/lib/types';

export async function getPushConfigAction(): Promise<
  { data: PushConfig } | { error: string }
> {
  await requireDashboardSession('/dashboard');
  const res = await getPushConfig();
  if (isApiError(res)) return { error: res.error.message };
  return { data: res.data };
}

export async function subscribePushAction(
  payload: PushSubscriptionPayload,
): Promise<{ error: string | null }> {
  await requireDashboardSession('/dashboard');
  const res = await subscribePush(payload);
  if (isApiError(res)) return { error: res.error.message };
  return { error: null };
}

export async function unsubscribePushAction(
  endpoint: string,
): Promise<{ error: string | null }> {
  await requireDashboardSession('/dashboard');
  const res = await unsubscribePush(endpoint);
  if (isApiError(res)) return { error: res.error.message };
  return { error: null };
}
