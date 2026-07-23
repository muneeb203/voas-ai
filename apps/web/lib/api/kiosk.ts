import 'server-only';
import { apiCall } from './client';
import { apiFetch } from '@/lib/api';
import type { ApiResponse } from '@/lib/types';

export interface KioskToken {
  id: string;
  location_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface KioskSettings {
  theme: 'warm' | 'light' | 'gradient';
  session_lock_enabled: boolean;
  kiosk_enabled: boolean;
  max_kiosk_urls: number;
  kiosk_monthly_limit: number;
  kiosk_credits_balance: number;
  kiosk_credits_used_this_month: number;
  kiosk_month_start: string | null;
  restaurant_tone: string | null;
  restaurant_handover: string | null;
  salon_tone: string | null;
  salon_handover: string | null;
  phone_ordering_enabled?: boolean;
  phone_order_lock_enabled?: boolean;
  phone_order_lock_minutes?: number;
}

export interface KioskInfo {
  location_name: string;
  workspace_name: string;
  theme: 'warm' | 'light' | 'gradient';
  session_lock_enabled: boolean;
  vertical: string;
  order_mode: 'voice' | 'manual' | 'both';
}

export function listKioskTokens(workspaceId: string) {
  return apiCall<KioskToken[]>(`/v1/workspaces/${workspaceId}/kiosk-tokens`, {
    next: { revalidate: 30 },
  });
}

export function generateKioskToken(workspaceId: string, locationId: string) {
  return apiCall<KioskToken>(
    `/v1/workspaces/${workspaceId}/locations/${locationId}/kiosk-tokens`,
    { method: 'POST' },
  );
}

export function revokeKioskToken(workspaceId: string, tokenId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/kiosk-tokens/${tokenId}`, {
    method: 'DELETE',
  });
}

export function getKioskSettings(workspaceId: string) {
  // Config that an admin/owner changes and expects to see immediately — don't
  // serve a stale cached copy (the 30s cache made toggles look like they hadn't
  // saved).
  return apiCall<KioskSettings>(`/v1/workspaces/${workspaceId}/kiosk-settings`, {
    cache: 'no-store',
  });
}

export function updateKioskSettings(
  workspaceId: string,
  body: Partial<KioskSettings>,
) {
  return apiCall<KioskSettings>(`/v1/workspaces/${workspaceId}/kiosk-settings`, {
    method: 'PATCH',
    body,
  });
}

export async function getKioskInfo(token: string): Promise<ApiResponse<KioskInfo>> {
  return apiFetch<KioskInfo>(`/v1/kiosk/${token}`, { cache: 'no-store' });
}
