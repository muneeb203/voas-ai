'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';
import { apiCall } from '@/lib/api/client';
import { isApiError } from '@/lib/types';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type DayHours = { enabled: boolean; start: string; end: string };

export interface ConsultationHours {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
}

export async function getConsultationHoursAction() {
  const session = await requireDashboardSession('/settings?tab=availability');
  const workspaceId = session.active.workspace.id;

  const res = await apiCall<{ hours: ConsultationHours }>(
    `/v1/workspaces/${workspaceId}/consultation-hours`
  );

  if (isApiError(res)) {
    return { error: res.error.message };
  }

  return { hours: res.data.hours };
}

export async function saveConsultationHoursAction(hours: ConsultationHours) {
  const session = await requireDashboardSession('/settings?tab=availability');
  const workspaceId = session.active.workspace.id;

  const res = await apiCall<{ hours: ConsultationHours }>(
    `/v1/workspaces/${workspaceId}/consultation-hours`,
    {
      method: 'PATCH',
      body: { hours },
    }
  );

  if (isApiError(res)) {
    return { error: res.error.message };
  }

  return { hours: res.data.hours };
}
