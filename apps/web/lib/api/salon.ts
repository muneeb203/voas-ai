import 'server-only';
import { apiCall } from './client';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface SalonService {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  sort_order: number;
}

export interface StaffHours {
  weekday: number; // 0=Sunday .. 6=Saturday
  start_time: string; // 'HH:MM'
  end_time: string;
}

export interface SalonStaff {
  id: string;
  workspace_id: string;
  location_id: string | null;
  name: string;
  title: string | null;
  is_active: boolean;
  sort_order: number;
  service_ids: string[];
  hours: StaffHours[];
}

export interface SalonAppointment {
  id: string;
  workspace_id: string;
  location_id: string | null;
  staff_id: string | null;
  service_id: string | null;
  service_name: string;
  staff_name: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  notes: string | null;
  created_at: string;
}

export interface ServiceInput {
  name: string;
  description?: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  sort_order?: number;
}

export interface StaffInput {
  name: string;
  title?: string | null;
  is_active: boolean;
  service_ids: string[];
  hours: StaffHours[];
  sort_order?: number;
}

// --- Services ---------------------------------------------------------------

export function listServices(workspaceId: string) {
  return apiCall<SalonService[]>(`/v1/workspaces/${workspaceId}/salon/services`, {
    cache: 'no-store',
  });
}

export function createService(workspaceId: string, body: ServiceInput) {
  return apiCall<SalonService>(`/v1/workspaces/${workspaceId}/salon/services`, {
    method: 'POST',
    body,
  });
}

export function updateService(workspaceId: string, serviceId: string, body: Partial<ServiceInput>) {
  return apiCall<SalonService>(`/v1/workspaces/${workspaceId}/salon/services/${serviceId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteService(workspaceId: string, serviceId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/salon/services/${serviceId}`, {
    method: 'DELETE',
  });
}

// --- Staff ------------------------------------------------------------------

export function listStaff(workspaceId: string) {
  return apiCall<SalonStaff[]>(`/v1/workspaces/${workspaceId}/salon/staff`, { cache: 'no-store' });
}

export function createStaff(workspaceId: string, body: StaffInput) {
  return apiCall<SalonStaff>(`/v1/workspaces/${workspaceId}/salon/staff`, { method: 'POST', body });
}

export function updateStaff(workspaceId: string, staffId: string, body: Partial<StaffInput>) {
  return apiCall<SalonStaff>(`/v1/workspaces/${workspaceId}/salon/staff/${staffId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteStaff(workspaceId: string, staffId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/salon/staff/${staffId}`, { method: 'DELETE' });
}

// --- Appointments -----------------------------------------------------------

export function listAppointments(workspaceId: string, params?: { status?: string }) {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiCall<SalonAppointment[]>(`/v1/workspaces/${workspaceId}/salon/appointments${qs}`, {
    cache: 'no-store',
  });
}

export function updateAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: AppointmentStatus,
) {
  return apiCall<SalonAppointment>(
    `/v1/workspaces/${workspaceId}/salon/appointments/${appointmentId}/status`,
    { method: 'PATCH', body: { status } },
  );
}
