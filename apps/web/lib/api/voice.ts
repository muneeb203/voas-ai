import 'server-only';
import { apiCall } from './client';
import type {
  LocationVoiceConfigSafe,
  VoiceCapabilities,
  VoiceLanguage,
  VoiceSettings,
} from '@/lib/types';

export function getVoiceCapabilities() {
  return apiCall<VoiceCapabilities>('/v1/voice/capabilities', { cache: 'no-store' });
}

export function getVoiceSettings(workspaceId: string) {
  return apiCall<VoiceSettings>(`/v1/workspaces/${workspaceId}/voice/settings`, {
    cache: 'no-store',
  });
}

export function updateVoiceSettings(
  workspaceId: string,
  payload: Partial<{
    system_prompt: string;
    greeting: string;
    voice: string;
    model: string;
    language: VoiceLanguage;
    enabled: boolean;
    send_order_confirmations: boolean;
  }>,
) {
  return apiCall<VoiceSettings>(`/v1/workspaces/${workspaceId}/voice/settings`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getLocationVoice(workspaceId: string, locationId: string) {
  return apiCall<LocationVoiceConfigSafe | null>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/voice`,
    { cache: 'no-store' },
  );
}

export function upsertLocationVoice(
  workspaceId: string,
  locationId: string,
  payload: {
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    enabled: boolean;
  },
) {
  return apiCall<LocationVoiceConfigSafe>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/voice`,
    { method: 'PUT', body: payload },
  );
}

export function disableLocationVoice(workspaceId: string, locationId: string) {
  return apiCall<null>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/voice`,
    { method: 'DELETE' },
  );
}
