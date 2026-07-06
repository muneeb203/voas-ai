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

export interface KioskChatResponse {
  response: string;
  order_confirmed: boolean;
  order?: {
    items?: Array<{ name: string; qty: number; price?: string }>;
    order_number?: string;
    total?: string;
  };
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
