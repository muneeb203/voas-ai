import type { ApiResponse } from '@/lib/types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204) return { data: null as T };
  const json = await res.json().catch(() => null);
  if (!json) {
    return { error: { code: 'NETWORK_ERROR', message: `Request failed (${res.status})` } };
  }
  return json as ApiResponse<T>;
}

export function claimKioskSession(
  token: string,
  sessionId: string,
): Promise<ApiResponse<{ claimed: boolean }>> {
  return publicFetch(`/v1/kiosk/${token}/claim`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function heartbeatKioskSession(
  token: string,
  sessionId: string,
): Promise<ApiResponse<{ alive: boolean }>> {
  return publicFetch(`/v1/kiosk/${token}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export interface KioskMetricPayload {
  stt_source: 'deepgram' | 'browser';
  stt_confidence: number | null;
  chat_ms: number | null;
  anthropic_ms: number | null;
  tts_ms: number | null;
  order_placed: boolean;
}

// Fire-and-forget per-turn metrics for the admin Kiosk Performance card.
// Never blocks or breaks the turn.
export function reportKioskMetrics(token: string, payload: KioskMetricPayload): void {
  void publicFetch(`/v1/kiosk/${token}/metrics`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export interface KioskChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface KioskAppointment {
  kind: 'booked' | 'checked_in';
  service_name: string;
  staff_name?: string | null;
  when: string;
  order_number?: string;
}

export interface KioskChatResponse {
  response: string;
  order_confirmed: boolean;
  order?: {
    items?: Array<{ name: string; qty: number; price?: string }>;
    order_number?: string;
    total?: string;
  };
  appointment?: KioskAppointment;
  debug?: {
    anthropic_ms?: number | null;
    cache_read?: number | null;
    cache_write?: number | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
  };
}

export function kioskChat(
  token: string,
  messages: KioskChatMessage[],
): Promise<ApiResponse<KioskChatResponse>> {
  return publicFetch(`/v1/kiosk/${token}/chat`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

export async function kioskSpeak(token: string, text: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/kiosk/${token}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return res.blob();
    return null;
  } catch {
    return null;
  }
}


// ── Manual (tap-to-order) mode ────────────────────────────────────────────────

export interface KioskMenuOption {
  id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
}

export interface KioskMenuGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  options: KioskMenuOption[];
}

export interface KioskMenuItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  modifier_groups: KioskMenuGroup[];
}

export interface KioskMenuCategory {
  id: string;
  name: string;
  items: KioskMenuItem[];
}

export interface KioskMenu {
  categories: KioskMenuCategory[];
  currency_symbol: string;
  currency_decimals: number;
}

export interface ManualOrderLine {
  item_id: string;
  quantity: number;
  option_ids: string[];
}

export interface ManualOrderResult {
  success: boolean;
  order_id: string | null;
  order_number: string | null;
  total: string | null;
  message: string | null;
}

export function getKioskMenu(token: string): Promise<ApiResponse<KioskMenu>> {
  return publicFetch(`/v1/kiosk/${token}/menu`, { cache: 'no-store' });
}

export function placeManualOrder(
  token: string,
  items: ManualOrderLine[],
): Promise<ApiResponse<ManualOrderResult>> {
  return publicFetch(`/v1/kiosk/${token}/manual-order`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}


export function getPhoneMenu(token: string): Promise<ApiResponse<KioskMenu>> {
  return publicFetch(`/v1/order/${token}/menu`, { cache: 'no-store' });
}

export function getPhoneOrderInfo(
  token: string,
): Promise<ApiResponse<{ workspace_name: string; location_name: string }>> {
  return publicFetch(`/v1/order/${token}/info`, { cache: 'no-store' });
}

export function placePhoneOrder(
  token: string,
  items: ManualOrderLine[],
): Promise<ApiResponse<ManualOrderResult>> {
  return publicFetch(`/v1/order/${token}/place`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}
