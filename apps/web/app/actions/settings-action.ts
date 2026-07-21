'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { deleteWorkspace, updateWorkspace } from '@/lib/api/workspaces';
import { isApiError } from '@/lib/types';
import { requireDashboardSession } from '@/lib/auth/workspace';

const WorkspaceSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(120),
  vertical: z.enum(['restaurant', 'dental', 'salon', 'auto', 'other']),
  currency: z.enum(['USD', 'PKR', 'AED', 'SAR', 'GBP', 'EUR', 'INR']),
});

const ProfileSchema = z.object({
  fullName: z.string().min(2, 'Name is too short').max(120),
});

export type FormState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const IDLE: FormState = { status: 'idle' };

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !result[path]) result[path] = issue.message;
  }
  return result;
}

export async function updateWorkspaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireDashboardSession('/settings');

  if (session.active.role !== 'owner') {
    return { status: 'error', message: 'Only owners can change workspace settings.' };
  }

  const parsed = WorkspaceSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    vertical: String(formData.get('vertical') ?? 'restaurant'),
    currency: String(formData.get('currency') ?? 'USD'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await updateWorkspace(session.active.workspace_id, parsed.data);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Workspace updated.' };
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireDashboardSession('/settings/profile');

  const parsed = ProfileSchema.safeParse({
    fullName: String(formData.get('fullName') ?? '').trim(),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Profile updated.' };
}

export async function deleteWorkspaceAction(): Promise<FormState> {
  const session = await requireDashboardSession('/settings');

  if (session.active.role !== 'owner') {
    return { status: 'error', message: 'Only owners can delete the workspace.' };
  }

  const res = await deleteWorkspace(session.active.workspace_id);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
