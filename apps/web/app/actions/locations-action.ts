'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from '@/lib/api/locations';
import { isApiError, type LocationHours } from '@/lib/types';

const DayHoursSchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const HoursSchema = z.record(DayHoursSchema);

const LocationSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(200),
  address: z.string().max(300).optional().or(z.literal('').transform(() => undefined)),
  city: z.string().max(120).optional().or(z.literal('').transform(() => undefined)),
  state: z.string().max(60).optional().or(z.literal('').transform(() => undefined)),
  postal_code: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(50).optional().or(z.literal('').transform(() => undefined)),
  hours: HoursSchema.nullable().optional(),
});

export type LocationFormState =
  | { status: 'idle' }
  | { status: 'success'; locationId: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const IDLE: LocationFormState = { status: 'idle' };

function parseFormPayload(formData: FormData) {
  const hoursJson = String(formData.get('hours_json') ?? '');
  let hours: LocationHours | null | undefined;
  if (hoursJson) {
    try {
      hours = JSON.parse(hoursJson);
    } catch {
      hours = undefined;
    }
  }

  return {
    name: String(formData.get('name') ?? '').trim(),
    address: String(formData.get('address') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    state: String(formData.get('state') ?? '').trim(),
    postal_code: String(formData.get('postal_code') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    hours,
  };
}

function fieldErrorsFromZod(err: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !result[path]) result[path] = issue.message;
  }
  return result;
}

export async function createLocationAction(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const session = await requireDashboardSession('/locations');
  if (session.active.role !== 'owner') {
    return { status: 'error', message: 'Only owners can add locations.' };
  }

  const parsed = LocationSchema.safeParse(parseFormPayload(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await createLocation(session.active.workspace_id, parsed.data);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/locations');
  revalidatePath('/dashboard');
  return { status: 'success', locationId: res.data.id };
}

export async function updateLocationAction(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const session = await requireDashboardSession('/locations');
  if (session.active.role !== 'owner') {
    return { status: 'error', message: 'Only owners can edit locations.' };
  }

  const locationId = String(formData.get('id') ?? '');
  if (!locationId) {
    return { status: 'error', message: 'Missing location id' };
  }

  const parsed = LocationSchema.safeParse(parseFormPayload(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await updateLocation(session.active.workspace_id, locationId, parsed.data);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/locations');
  return { status: 'success', locationId };
}

export async function deleteLocationAction(locationId: string) {
  const session = await requireDashboardSession('/locations');
  if (session.active.role !== 'owner') {
    return { error: 'Only owners can delete locations.' };
  }

  const res = await deleteLocation(session.active.workspace_id, locationId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/locations');
  return { error: null };
}
