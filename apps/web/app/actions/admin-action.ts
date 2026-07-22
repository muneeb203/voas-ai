'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/lib/auth/admin';
import {
  clearImpersonation,
  readImpersonation,
  setImpersonation,
} from '@/lib/auth/impersonation';
import {
  adminDeleteWorkspace,
  adminReply,
  adminUpdateTicket,
  endImpersonation as apiEndImpersonation,
  restoreWorkspace,
  startImpersonation as apiStartImpersonation,
  suspendWorkspace,
  updateContactSubmission,
} from '@/lib/api/admin';
import { isApiError, type TicketStatus } from '@/lib/types';

// --- Impersonation ----------------------------------------------------------

export async function startImpersonationAction(workspaceId: string) {
  const session = await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const res = await apiStartImpersonation(workspaceId);
  if (isApiError(res)) return { error: res.error.message };

  setImpersonation({
    workspace_id: res.data.workspace_id,
    workspace_name: res.data.workspace_name,
    admin_id: session.user.id,
    started_at: res.data.started_at,
  });

  redirect('/dashboard');
}

export async function exitImpersonationAction() {
  await requireAdminSession('/admin/workspaces');
  const state = readImpersonation();
  await apiEndImpersonation(state?.workspace_id);
  clearImpersonation();
  redirect('/admin/workspaces');
}

// --- Workspace lifecycle ----------------------------------------------------

export async function suspendWorkspaceAction(workspaceId: string) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const res = await suspendWorkspace(workspaceId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath('/admin/workspaces');
  return { error: null };
}

export async function restoreWorkspaceAction(workspaceId: string) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const res = await restoreWorkspace(workspaceId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath('/admin/workspaces');
  return { error: null };
}

export async function deleteWorkspaceAction(workspaceId: string) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const res = await adminDeleteWorkspace(workspaceId);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/admin/workspaces');
  redirect('/admin/workspaces');
}

// --- Admin ticket actions ---------------------------------------------------

export async function adminReplyAction(
  ticketId: string,
  body: string,
  isInternalNote: boolean,
) {
  await requireAdminSession(`/admin/support/${ticketId}`);
  const res = await adminReply(ticketId, body, isInternalNote);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath('/admin/support');
  return { error: null };
}

export async function adminTicketStatusAction(
  ticketId: string,
  status: TicketStatus,
) {
  await requireAdminSession(`/admin/support/${ticketId}`);
  const res = await adminUpdateTicket(ticketId, { status });
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath('/admin/support');
  return { error: null };
}

// --- Contact submission actions --------------------------------------------

export async function adminUpdateContactStatusAction(
  submissionId: string,
  status: 'new' | 'contacted' | 'qualified' | 'closed',
) {
  await requireAdminSession('/admin/contact-submissions');
  const res = await updateContactSubmission(submissionId, { status });
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/admin/contact-submissions');
  return { error: null };
}

// --- Billing / usage -------------------------------------------------------

export async function grantWorkspaceCreditsAction(
  workspaceId: string,
  body: { credit_type: import('@/lib/types').CreditType; amount: number; reason?: string },
) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { grantWorkspaceCredits } = await import('@/lib/api/admin');
  const res = await grantWorkspaceCredits(workspaceId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath('/admin/usage');
  return { error: null };
}

export async function deductWorkspaceCreditsAction(
  workspaceId: string,
  body: { credit_type: import('@/lib/types').CreditType; amount: number; reason?: string },
) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { deductWorkspaceCredits } = await import('@/lib/api/admin');
  const res = await deductWorkspaceCredits(workspaceId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath('/admin/usage');
  return { error: null, deducted: res.data.deducted };
}

export async function updateWorkspaceBillingAction(
  workspaceId: string,
  body: { plan?: import('@/lib/types').PlanId; usage_enforcement_disabled?: boolean },
) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { updateAdminWorkspaceBilling } = await import('@/lib/api/admin');
  const res = await updateAdminWorkspaceBilling(workspaceId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath('/admin/usage');
  return { error: null };
}

// --- Kiosk settings actions -----------------------------------------------

export async function updateAdminKioskSettingsAction(
  workspaceId: string,
  body: {
    kiosk_enabled?: boolean;
    max_kiosk_urls?: number;
    kiosk_monthly_limit?: number;
    manual_ordering_enabled?: boolean;
    kiosk_order_mode?: 'voice' | 'manual' | 'both';
    phone_ordering_enabled?: boolean;
  },
) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { updateAdminKioskSettings } = await import('@/lib/api/admin');
  const res = await updateAdminKioskSettings(workspaceId, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { error: null };
}

export async function setWorkspaceVoiceModelAction(workspaceId: string, model: string) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { setWorkspaceVoiceModel } = await import('@/lib/api/admin');
  const res = await setWorkspaceVoiceModel(workspaceId, model);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { error: null };
}

export async function topupKioskCreditsAction(workspaceId: string, amount: number) {
  await requireAdminSession(`/admin/workspaces/${workspaceId}`);
  const { topupKioskCredits } = await import('@/lib/api/admin');
  const res = await topupKioskCredits(workspaceId, amount);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { error: null };
}
