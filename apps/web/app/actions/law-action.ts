'use server';

import { revalidatePath } from 'next/cache';
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

export interface BookLawAppointmentInput {
  starts_at: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  notes?: string | null;
}

export async function bookLawAppointmentAction(body: BookLawAppointmentInput) {
  const session = await requireDashboardSession('/appointments');
  const workspaceId = session.active.workspace.id;

  const res = await apiCall(
    `/v1/workspaces/${workspaceId}/law/appointments`,
    {
      method: 'POST',
      body,
    }
  );

  if (isApiError(res)) {
    return { error: res.error.message };
  }

  revalidatePath('/appointments');
  return { error: null };
}
