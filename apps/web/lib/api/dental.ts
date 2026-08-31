import 'server-only';
import { apiCall } from './client';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface DentalService {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StaffHours {
  weekday: number; // 0=Sunday .. 6=Saturday
  start_time: string; // 'HH:MM'
  end_time: string;
  break_start?: string;
  break_end?: string;
}

export interface DentalStaff {
  id: string;
  workspace_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DentalAppointment {
  id: string;
  workspace_id: string;
  location_id: string | null;
  service_id: string;
  staff_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  conversation_id: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  staff_name: string;
}

export interface AvailabilityResult {
  date: string;
  service_id: string;
  slots: AvailabilitySlot[];
}

export interface BookInput {
  service_id: string;
  staff_id: string;
  starts_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  location_id?: string | null;
  notes?: string | null;
}

export interface ServiceInput {
  name: string;
  description?: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_after_minutes: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface StaffInput {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface StaffHoursInput {
  weekday: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
}

// --- Services ---------------------------------------------------------------

export function listServices(workspaceId: string, activeOnly = false) {
  const qs = activeOnly ? '?active_only=true' : '';
  return apiCall<DentalService[]>(`/v1/workspaces/${workspaceId}/dental/services${qs}`, {
    cache: 'no-store',
  });
}

export function createService(workspaceId: string, body: ServiceInput) {
  return apiCall<DentalService>(`/v1/workspaces/${workspaceId}/dental/services`, {
    method: 'POST',
    body,
  });
}

export function updateService(workspaceId: string, serviceId: string, body: Partial<ServiceInput>) {
  return apiCall<DentalService>(`/v1/workspaces/${workspaceId}/dental/services/${serviceId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteService(workspaceId: string, serviceId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/dental/services/${serviceId}`, {
    method: 'DELETE',
  });
}

// --- Staff ------------------------------------------------------------------

export function listStaff(workspaceId: string) {
  return apiCall<DentalStaff[]>(`/v1/workspaces/${workspaceId}/dental/staff`, { cache: 'no-store' });
}

export function createStaff(workspaceId: string, body: StaffInput) {
  return apiCall<DentalStaff>(`/v1/workspaces/${workspaceId}/dental/staff`, { method: 'POST', body });
}

export function updateStaff(workspaceId: string, staffId: string, body: Partial<StaffInput>) {
  return apiCall<DentalStaff>(`/v1/workspaces/${workspaceId}/dental/staff/${staffId}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteStaff(workspaceId: string, staffId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/dental/staff/${staffId}`, { method: 'DELETE' });
}

export function updateStaffHours(workspaceId: string, staffId: string, body: StaffHoursInput) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/dental/staff/${staffId}/hours`, {
    method: 'PUT',
    body,
  });
}

// --- Appointments -----------------------------------------------------------

export function listAppointments(workspaceId: string, params?: { date_start?: string; date_end?: string }) {
  const qs = new URLSearchParams();
  if (params?.date_start) qs.set('date_start', params.date_start);
  if (params?.date_end) qs.set('date_end', params.date_end);
  const qsStr = qs.toString();
  return apiCall<DentalAppointment[]>(
    `/v1/workspaces/${workspaceId}/dental/appointments${qsStr ? '?' + qsStr : ''}`,
    { cache: 'no-store' },
  );
}

export function updateAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: AppointmentStatus,
) {
  return apiCall<DentalAppointment>(
    `/v1/workspaces/${workspaceId}/dental/appointments/${appointmentId}/status`,
    { method: 'PUT', body: { status } },
  );
}

export function getAvailability(
  workspaceId: string,
  serviceId: string,
  date: string,
  staffId?: string,
) {
  const qs = new URLSearchParams({ service_id: serviceId, date });
  if (staffId) qs.set('staff_id', staffId);
  return apiCall<AvailabilityResult>(
    `/v1/workspaces/${workspaceId}/dental/availability?${qs.toString()}`,
    { cache: 'no-store' },
  );
}

export function bookAppointment(workspaceId: string, body: BookInput) {
  return apiCall<DentalAppointment>(`/v1/workspaces/${workspaceId}/dental/appointments`, {
    method: 'POST',
    body,
  });
}

export function rescheduleAppointment(
  workspaceId: string,
  appointmentId: string,
  body: { new_starts_at: string },
) {
  return apiCall<DentalAppointment>(
    `/v1/workspaces/${workspaceId}/dental/appointments/${appointmentId}/reschedule`,
    { method: 'PUT', body },
  );
}
