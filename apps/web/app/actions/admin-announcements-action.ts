'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth/admin';
import { publishAnnouncement } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';

export type AnnouncementFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function publishAnnouncementAction(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  await requireAdminSession('/admin/announcements');

  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const linkRaw = String(formData.get('link') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = 'Title is required';
  if (!body) fieldErrors.body = 'Message is required';
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the fields below.', fieldErrors };
  }

  const res = await publishAnnouncement({
    title,
    body,
    link: linkRaw || null,
  });

  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/admin/announcements');
  return { status: 'success', message: 'Update sent to all workspace users.' };
}
