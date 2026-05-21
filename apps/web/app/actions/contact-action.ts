'use server';

import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import type { ContactSubmission } from '@/lib/types';

const ContactPayloadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  company: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  message: z.string().min(1).max(5000),
  source: z.string().max(200).optional(),
});

export type ContactFormState =
  | { status: 'idle' }
  | { status: 'success'; submissionId: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

export async function submitContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    company: String(formData.get('company') ?? '').trim() || undefined,
    phone: String(formData.get('phone') ?? '').trim() || undefined,
    message: String(formData.get('message') ?? '').trim(),
    source: String(formData.get('source') ?? '/contact'),
  };

  const parsed = ContactPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors,
    };
  }

  const res = await apiFetch<ContactSubmission>('/v1/contact', {
    method: 'POST',
    body: parsed.data,
  });

  if ('error' in res) {
    return {
      status: 'error',
      message: res.error.message || 'Could not submit. Try again in a moment.',
    };
  }

  return { status: 'success', submissionId: res.data.id };
}
