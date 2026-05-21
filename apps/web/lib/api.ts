import type { ApiResponse } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
  next?: NextFetchRequestConfig;
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<ApiResponse<T>> {
  const { body, token, idempotencyKey, headers, next, ...rest } = init;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (idempotencyKey) finalHeaders['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(next ? { next } : {}),
  });

  if (res.status === 204) {
    return { data: null as T };
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!json) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: `Request failed (${res.status} ${res.statusText})`,
      },
    };
  }

  return json;
}
