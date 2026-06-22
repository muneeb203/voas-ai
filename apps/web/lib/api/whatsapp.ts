import 'server-only';
import { apiCall } from './client';
import type {
  LocationWhatsAppConfigSafe,
  WhatsAppCapabilities,
  WhatsAppSettings,
} from '@/lib/types';

export function getWhatsAppCapabilities() {
  return apiCall<WhatsAppCapabilities>('/v1/whatsapp/capabilities', {
    next: { revalidate: 300 },
  });
}

export function getWhatsAppSettings(workspaceId: string) {
  return apiCall<WhatsAppSettings>(`/v1/workspaces/${workspaceId}/whatsapp/settings`, {
    next: { revalidate: 60 },
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
    { next: { revalidate: 60 } },
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
