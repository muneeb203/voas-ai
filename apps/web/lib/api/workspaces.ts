import 'server-only';
import { apiCall } from './client';
import type { CurrentUserProfile, Workspace } from '@/lib/types';

export interface WorkspaceCreatePayload {
  name: string;
  vertical: string;
  location_name?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  location_phone?: string | null;
  location_timezone?: string | null;
  location_hours?: Record<string, unknown> | null;
}

export interface WorkspaceUpdatePayload {
  name?: string;
  vertical?: string;
  currency?: string;
}

export function getMe() {
  return apiCall<CurrentUserProfile>('/v1/me', { cache: 'no-store' });
}

export function createWorkspace(payload: WorkspaceCreatePayload) {
  return apiCall<Workspace>('/v1/workspaces', { method: 'POST', body: payload });
}

export function getWorkspace(workspaceId: string) {
  return apiCall<Workspace>(`/v1/workspaces/${workspaceId}`, { cache: 'no-store' });
}

export function updateWorkspace(workspaceId: string, payload: WorkspaceUpdatePayload) {
  return apiCall<Workspace>(`/v1/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteWorkspace(workspaceId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}`, { method: 'DELETE' });
}
