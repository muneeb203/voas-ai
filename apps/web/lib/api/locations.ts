import 'server-only';
import { apiCall } from './client';
import type { Location, LocationHours } from '@/lib/types';

export interface LocationCreatePayload {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  timezone?: string;
  hours?: LocationHours | null;
  is_active?: boolean;
}

export type LocationUpdatePayload = Partial<LocationCreatePayload>;

export function listLocations(workspaceId: string) {
  return apiCall<Location[]>(`/v1/workspaces/${workspaceId}/locations`, { cache: 'no-store' });
}

export function createLocation(workspaceId: string, payload: LocationCreatePayload) {
  return apiCall<Location>(`/v1/workspaces/${workspaceId}/locations`, {
    method: 'POST',
    body: payload,
  });
}

export function updateLocation(
  workspaceId: string,
  locationId: string,
  payload: LocationUpdatePayload,
) {
  return apiCall<Location>(`/v1/workspaces/${workspaceId}/locations/${locationId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteLocation(workspaceId: string, locationId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/locations/${locationId}`, {
    method: 'DELETE',
  });
}
