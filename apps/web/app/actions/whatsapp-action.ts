'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  deleteLocationWhatsAppConfig,
  updateWhatsAppSettings,
  upsertLocationWhatsAppConfig,
} from '@/lib/api/whatsapp';
import { isApiError } from '@/lib/types';

const SettingsSchema = z.object({
  system_prompt: z.string().min(20, 'Add a bit more detail to the prompt').max(8000),
  greeting: z.string().min(2).max(500),
  model: z.string().min(1).max(80),
  enabled: z.boolean(),
  session_window_hours: z.number().int().min(1).max(168),
});

const LocationWhatsAppSchema = z.object({
  twilio_account_sid: z
    .string()
    .regex(/^AC[a-zA-Z0-9]{30,}$/, 'SID looks like ACxxxxxxxxxxxxxxxx'),
  twilio_auth_token: z.string().min(10).max(128),
  twilio_whatsapp_number: z
    .string()
    .regex(/^\+\d{8,15}$/, 'Use E.164 format (e.g. +14155238886)'),
  enabled: z.boolean(),
});

export type FormResult = { error: string | null; fieldErrors?: Record<string, string> };

function fieldErrorsFromZod(err: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !result[path]) result[path] = issue.message;
  }
  return result;
}

async function requireOwner(path: string) {
  const session = await requireDashboardSession(path);
  if (session.active.role !== 'owner') {
    return { error: 'Only workspace owners can configure WhatsApp.' as const, session: null };
  }
  return { error: null as null, session };
}

export async function updateWhatsAppSettingsAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { error, session } = await requireOwner('/integrations/whatsapp');
  if (error) return { error };

  const parsed = SettingsSchema.safeParse({
    system_prompt: String(formData.get('system_prompt') ?? '').trim(),
    greeting: String(formData.get('greeting') ?? '').trim(),
    model: String(formData.get('model') ?? 'gpt-4o-mini'),
    enabled: formData.get('enabled') === 'on',
    session_window_hours: Number(formData.get('session_window_hours') ?? 24),
  });
  if (!parsed.success) {
    return {
      error: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await updateWhatsAppSettings(session.active.workspace_id, parsed.data);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/integrations');
  revalidatePath('/integrations/whatsapp');
  return { error: null };
}

export async function upsertLocationWhatsAppAction(
  locationId: string,
  payload: {
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_whatsapp_number: string;
    enabled: boolean;
  },
): Promise<FormResult> {
  const { error, session } = await requireOwner('/integrations/whatsapp');
  if (error) return { error };

  const parsed = LocationWhatsAppSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await upsertLocationWhatsAppConfig(
    session.active.workspace_id,
    locationId,
    parsed.data,
  );
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/integrations/whatsapp');
  revalidatePath('/integrations');
  return { error: null };
}

export async function disableLocationWhatsAppAction(
  locationId: string,
): Promise<FormResult> {
  const { error, session } = await requireOwner('/integrations/whatsapp');
  if (error) return { error };

  const res = await deleteLocationWhatsAppConfig(session.active.workspace_id, locationId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/integrations/whatsapp');
  revalidatePath('/integrations');
  return { error: null };
}
