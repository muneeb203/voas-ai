'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';
import { apiCall } from '@/lib/api/client';
import { isApiError } from '@/lib/types';

export interface AvailabilitySlot {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  staff_name: string;
}

export interface AvailabilityResult {
  date: string;
  slots: AvailabilitySlot[];
}

export async function getLawAvailabilityAction(
  date: string,
): Promise<{ error: string | null; slots: AvailabilitySlot[] }> {
  const session = await requireDashboardSession('/appointments');
  const workspaceId = session.active.workspace.id;

  const res = await apiCall<{ date: string; slots: AvailabilitySlot[] }>(
    `/v1/workspaces/${workspaceId}/law/availability?date=${date}`
  );

  if (isApiError(res)) {
    return { error: res.error.message, slots: [] };
  }

  return { error: null, slots: res.data.slots };
}
