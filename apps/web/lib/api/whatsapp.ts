import 'server-only';
import { apiCall } from './client';
import type {
  LocationWhatsAppConfigSafe,
  WhatsAppCapabilities,
  WhatsAppSettings,
} from '@/lib/types';

export function getWhatsAppCapabilities() {
  return apiCall<WhatsAppCapabilities>('/v1/whatsapp/capabilities', {
    cache: 'no-store',
  });
}

export function getWhatsAppSettings(workspaceId: string) {
  return apiCall<WhatsAppSettings>(`/v1/workspaces/${workspaceId}/whatsapp/settings`, {
    cache: 'no-store',
  });
}

export function updateWhatsAppSettings(
  workspaceId: string,
  payload: Partial<{
    system_prompt: string;
    greeting: string;
    model: string;
    enabled: boolean;
    session_window_hours: number;
  }>,
) {
  return apiCall<WhatsAppSettings>(`/v1/workspaces/${workspaceId}/whatsapp/settings`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getLocationWhatsAppConfig(workspaceId: string, locationId: string) {
  return apiCall<LocationWhatsAppConfigSafe | null>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/whatsapp`,
    { cache: 'no-store' },
  );
}

export function upsertLocationWhatsAppConfig(
  workspaceId: string,
  locationId: string,
  payload: {
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_whatsapp_number: string;
    enabled: boolean;
  },
) {
  return apiCall<LocationWhatsAppConfigSafe>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/whatsapp`,
    { method: 'PUT', body: payload },
  );
}

export function deleteLocationWhatsAppConfig(workspaceId: string, locationId: string) {
  return apiCall<null>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/whatsapp`,
    { method: 'DELETE' },
  );
}
