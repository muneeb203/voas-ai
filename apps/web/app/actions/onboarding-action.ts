'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createWorkspace } from '@/lib/api/workspaces';
import { isApiError } from '@/lib/types';

const Schema = z.object({
  workspaceName: z.string().min(2, 'Business name is too short').max(120),
  vertical: z.enum(['restaurant', 'dental', 'salon', 'auto', 'other']),
  locationName: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  timezone: z.string().max(100).optional(),
  hours: z.string().optional(),
  skipHours: z.string().optional(),
});

export type OnboardingFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

export async function completeOnboarding(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }

  const raw = {
    workspaceName: String(formData.get('workspaceName') ?? '').trim(),
    vertical: String(formData.get('vertical') ?? 'restaurant'),
    locationName: String(formData.get('locationName') ?? '').trim() || undefined,
    address: String(formData.get('address') ?? '').trim() || undefined,
    city: String(formData.get('city') ?? '').trim() || undefined,
    state: String(formData.get('state') ?? '').trim() || undefined,
    zip: String(formData.get('zip') ?? '').trim() || undefined,
    phone: String(formData.get('phone') ?? '').trim() || undefined,
    timezone: String(formData.get('timezone') ?? '').trim() || undefined,
    hours: String(formData.get('hours') ?? '').trim() || undefined,
    skipHours: String(formData.get('skipHours') ?? '').trim() || undefined,
  };

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { status: 'error', message: 'Please check the fields below.', fieldErrors };
  }

  const { workspaceName, vertical, locationName, address, city, state, zip, phone, timezone, hours, skipHours } =
    parsed.data;

  let hoursData: Record<string, unknown> | null = null;
  if (!skipHours && hours) {
    try {
      hoursData = JSON.parse(hours) as Record<string, unknown>;
    } catch {
      // ignore malformed hours
    }
  }

  const res = await createWorkspace({
    name: workspaceName,
    vertical,
    location_name: locationName || null,
    location_address: address || null,
    location_city: city || null,
    location_state: state || null,
    location_zip: zip || null,
    location_phone: phone || null,
    location_timezone: timezone || null,
    location_hours: hoursData,
  });

  if (isApiError(res)) {
    if (res.error.code === 'CONFLICT') {
      revalidatePath('/', 'layout');
      redirect('/dashboard');
    }
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function skipOnboarding(workspaceName: string, vertical: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const res = await createWorkspace({ name: workspaceName, vertical });

  if (isApiError(res) && res.error.code !== 'CONFLICT') return;

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
