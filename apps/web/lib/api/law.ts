import 'server-only';
import { apiCall } from './client';

export interface LawAppointment {
  id: string;
  workspace_id: string;
  service_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  starts_at: string;
  ends_at?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export function listLawAppointments(workspaceId: string) {
  return apiCall<LawAppointment[]>(`/v1/workspaces/${workspaceId}/law/appointments`, {
    cache: 'no-store',
  });
}
