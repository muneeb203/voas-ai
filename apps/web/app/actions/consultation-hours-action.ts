'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';

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

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/consultation-hours`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.auth?.session?.access_token}`,
        },
      }
    );

    if (!res.ok) {
      return { error: 'Failed to load consultation hours' };
    }

    const data = await res.json();
    return { hours: data.data.hours as ConsultationHours };
  } catch (error) {
    return { error: 'Failed to load consultation hours' };
  }
}

export async function saveConsultationHoursAction(hours: ConsultationHours) {
  const session = await requireDashboardSession('/settings?tab=availability');
  const workspaceId = session.active.workspace.id;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/consultation-hours`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth?.session?.access_token}`,
        },
        body: JSON.stringify({ hours }),
      }
    );

    if (!res.ok) {
      return { error: 'Failed to save consultation hours' };
    }

    const data = await res.json();
    return { hours: data.data.hours as ConsultationHours };
  } catch (error) {
    return { error: 'Failed to save consultation hours' };
  }
}
