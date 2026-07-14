'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  createService,
  updateService,
  deleteService,
  createStaff,
  updateStaff,
  deleteStaff,
  updateAppointmentStatus,
  type AppointmentStatus,
  type ServiceInput,
  type StaffInput,
} from '@/lib/api/salon';
import { isApiError } from '@/lib/types';

async function requireOwner(path: string) {
  const session = await requireDashboardSession(path);
  if (session.active.role !== 'owner') {
    return { error: 'Only workspace owners can change this.' as const, session: null };
  }
  return { error: null as null, session };
}

// --- Services ---------------------------------------------------------------

export async function createServiceAction(body: ServiceInput) {
  const { error, session } = await requireOwner('/services');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await createService(session.active.workspace_id, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/services');
  return { error: null };
}

export async function updateServiceAction(serviceId: string, body: Partial<ServiceInput>) {
  const { error, session } = await requireOwner('/services');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await updateService(session.active.workspace_id, serviceId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/services');
  return { error: null };
}

export async function deleteServiceAction(serviceId: string) {
  const { error, session } = await requireOwner('/services');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await deleteService(session.active.workspace_id, serviceId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/services');
  return { error: null };
}

// --- Staff ------------------------------------------------------------------

export async function createStaffAction(body: StaffInput) {
  const { error, session } = await requireOwner('/staff');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await createStaff(session.active.workspace_id, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/staff');
  return { error: null };
}

export async function updateStaffAction(staffId: string, body: Partial<StaffInput>) {
  const { error, session } = await requireOwner('/staff');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await updateStaff(session.active.workspace_id, staffId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/staff');
  return { error: null };
}

export async function deleteStaffAction(staffId: string) {
  const { error, session } = await requireOwner('/staff');
  if (error || !session) return { error: error ?? 'Unauthorized' };
  const res = await deleteStaff(session.active.workspace_id, staffId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/staff');
  return { error: null };
}

// --- Appointments -----------------------------------------------------------

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
) {
  const session = await requireDashboardSession('/appointments');
  const res = await updateAppointmentStatus(session.active.workspace_id, appointmentId, status);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/appointments');
  return { error: null };
}
