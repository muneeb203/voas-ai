'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  disableLocationVoice,
  getVoiceSyncStatus,
  testLocationVoice,
  updateVoiceSettings,
  upsertLocationVoice,
} from '@/lib/api/voice';
import { isApiError } from '@/lib/types';

const SettingsSchema = z.object({
  system_prompt: z.string().min(20, 'Add a bit more detail to the prompt').max(8000),
  greeting: z.string().min(5).max(500),
  voice: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  language: z.enum(['en', 'ar', 'ur']),
  enabled: z.boolean(),
  send_order_confirmations: z.boolean(),
});

const LocationVoiceSchema = z.object({
  twilio_account_sid: z.string().regex(/^AC[a-zA-Z0-9]{30,}$/, 'SID looks like ACxxxxxxxxxxxxxxxx'),
  twilio_auth_token: z.string().min(10).max(128),
  twilio_phone_number: z
    .string()
    .regex(/^\+\d{8,15}$/, 'Use E.164 format (e.g. +14155551234)'),
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
    return { error: 'Only workspace owners can configure voice.' as const, session: null };
  }
  return { error: null as null, session };
}

export async function updateVoiceSettingsAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { error, session } = await requireOwner('/integrations/voice');
  if (error) return { error };

  const parsed = SettingsSchema.safeParse({
    system_prompt: String(formData.get('system_prompt') ?? '').trim(),
    greeting: String(formData.get('greeting') ?? '').trim(),
    voice: String(formData.get('voice') ?? 'rachel'),
    model: String(formData.get('model') ?? 'gpt-4o-mini'),
    language: String(formData.get('language') ?? 'en'),
    enabled: formData.get('enabled') === 'on',
    send_order_confirmations: formData.get('send_order_confirmations') === 'on',
  });
  if (!parsed.success) {
    return {
      error: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await updateVoiceSettings(session.active.workspace_id, parsed.data);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/integrations');
  revalidatePath('/integrations/voice');
  return { error: null };
}

export async function getVoiceSyncStatusAction(): Promise<{
  status: 'pending' | 'synced' | 'error';
  error: string | null;
}> {
  const session = await requireDashboardSession('/integrations/voice');
  const res = await getVoiceSyncStatus(session.active.workspace_id);
  if (isApiError(res)) return { status: 'error', error: res.error.message };
  return { status: res.data.sync_status, error: res.data.sync_error };
}

export async function upsertLocationVoiceAction(
  locationId: string,
  payload: {
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    enabled: boolean;
  },
): Promise<FormResult> {
  const { error, session } = await requireOwner(`/locations`);
  if (error) return { error };

  const parsed = LocationVoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await upsertLocationVoice(
    session.active.workspace_id,
    locationId,
    parsed.data,
  );
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/locations');
  revalidatePath('/integrations');
  return { error: null };
}

export async function resyncMenuToVapiAction(): Promise<FormResult> {
  const { error, session } = await requireOwner('/integrations/voice');
  if (error) return { error };

  // PATCH with no fields → backend re-pulls the current menu and patches
  // the Vapi assistant. That's exactly what this button does.
  const { updateVoiceSettings } = await import('@/lib/api/voice');
  const res = await updateVoiceSettings(session.active.workspace_id, {});
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/integrations/voice');
  revalidatePath('/integrations');
  return { error: null };
}

export async function testLocationVoiceAction(
  locationId: string,
): Promise<{ ok: boolean; message: string }> {
  const { error, session } = await requireOwner('/locations');
  if (error) return { ok: false, message: error };

  const res = await testLocationVoice(session.active.workspace_id, locationId);
  if (isApiError(res)) return { ok: false, message: res.error.message };

  return { ok: res.data.ok, message: res.data.message };
}

export async function disableLocationVoiceAction(locationId: string): Promise<FormResult> {
  const { error, session } = await requireOwner('/locations');
  if (error) return { error };

  const res = await disableLocationVoice(session.active.workspace_id, locationId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/locations');
  revalidatePath('/integrations');
  return { error: null };
}
