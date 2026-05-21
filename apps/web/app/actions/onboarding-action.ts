'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createWorkspace } from '@/lib/api/workspaces';
import { isApiError } from '@/lib/types';

const Schema = z.object({
  workspaceName: z.string().min(2, 'Workspace name is too short').max(120),
  vertical: z.enum(['restaurant', 'dental', 'salon', 'auto', 'other']),
  locationName: z.string().min(2, 'Location name is too short').max(200),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
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

  const parsed = Schema.safeParse({
    workspaceName: String(formData.get('workspaceName') ?? '').trim(),
    vertical: String(formData.get('vertical') ?? 'restaurant'),
    locationName: String(formData.get('locationName') ?? '').trim(),
    address: String(formData.get('address') ?? '').trim() || undefined,
    phone: String(formData.get('phone') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { status: 'error', message: 'Please check the fields below.', fieldErrors };
  }

  const res = await createWorkspace({
    name: parsed.data.workspaceName,
    vertical: parsed.data.vertical,
    location_name: parsed.data.locationName,
    location_address: parsed.data.address,
    location_phone: parsed.data.phone,
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
