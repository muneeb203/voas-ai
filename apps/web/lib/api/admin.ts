import 'server-only';
import { apiCall } from './client';
import type {
  AdminWorkspaceUsageRow,
  Announcement,
  CreditGrant,
  CreditType,
  Location,
  Member,
  PlanId,
  SupportTicket,
  SupportTicketWithMessages,
  TicketStatus,
  UsageSummary,
  Workspace,
} from '@/lib/types';

// --- Admin workspace types ---

export interface AdminWorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  vertical: string;
  status: 'active' | 'suspended' | 'deleted';
  member_count: number;
  location_count: number;
  open_ticket_count: number;
  last_activity_at: string | null;
  error_count: number;
  voice_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminWorkspaceDetail {
  workspace: Workspace;
  members: Member[];
  locations: Location[];
}

export interface AdminUserSummary {
  id: string;
  email: string | null;
  full_name: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  is_admin: boolean;
  workspaces: Array<{
    workspace_id: string;
    workspace_name: string | null;
    workspace_slug: string | null;
    role: string;
  }>;
}

export interface AdminAuditEntry {
  id: string;
  actor_type: 'user' | 'admin' | 'system';
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  source: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  created_at: string;
}

// --- API calls ---

export function listAdminWorkspaces(params: {
  search?: string;
  status?: string;
  plan?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.plan) qs.set('plan', params.plan);
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiCall<AdminWorkspaceListItem[]>(`/v1/admin/workspaces${suffix}`, {
    cache: 'no-store',
  });
}

export function getAdminWorkspace(workspaceId: string) {
  return apiCall<AdminWorkspaceDetail>(`/v1/admin/workspaces/${workspaceId}`, {
    cache: 'no-store',
  });
}

export function suspendWorkspace(workspaceId: string) {
  return apiCall<Workspace>(`/v1/admin/workspaces/${workspaceId}/suspend`, { method: 'POST' });
}

export function restoreWorkspace(workspaceId: string) {
  return apiCall<Workspace>(`/v1/admin/workspaces/${workspaceId}/restore`, { method: 'POST' });
}

export function adminDeleteWorkspace(workspaceId: string) {
  return apiCall<null>(`/v1/admin/workspaces/${workspaceId}`, { method: 'DELETE' });
}

export interface ImpersonationPayload {
  workspace_id: string;
  workspace_name: string;
  started_at: string;
}

export function startImpersonation(workspaceId: string) {
  return apiCall<ImpersonationPayload>(`/v1/admin/workspaces/${workspaceId}/impersonate`, {
    method: 'POST',
  });
}

export function endImpersonation(workspaceId?: string) {
  return apiCall<null>(`/v1/admin/impersonate/exit`, {
    method: 'POST',
    body: { workspace_id: workspaceId ?? null },
  });
}

export function listAdminUsers() {
  return apiCall<AdminUserSummary[]>(`/v1/admin/users`, { cache: 'no-store' });
}

export function listAdminTickets(params: {
  status?: TicketStatus;
  priority?: string;
  workspaceId?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.priority) qs.set('priority', params.priority);
  if (params.workspaceId) qs.set('workspace_id', params.workspaceId);
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiCall<SupportTicket[]>(`/v1/admin/tickets${suffix}`, { cache: 'no-store' });
}

export function getAdminTicket(ticketId: string) {
  return apiCall<SupportTicketWithMessages>(`/v1/admin/tickets/${ticketId}`, {
    cache: 'no-store',
  });
}

export function adminReply(ticketId: string, body: string, isInternalNote = false) {
  return apiCall(`/v1/admin/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: { body, is_internal_note: isInternalNote },
  });
}

export function adminUpdateTicket(
  ticketId: string,
  patch: { status?: TicketStatus; assigned_admin_id?: string | null },
) {
  return apiCall<SupportTicket>(`/v1/admin/tickets/${ticketId}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function listContactSubmissions(statusFilter?: string) {
  const qs = statusFilter ? `?status=${statusFilter}` : '';
  return apiCall<AdminContactSubmission[]>(`/v1/admin/contact-submissions${qs}`, {
    cache: 'no-store',
  });
}

export function updateContactSubmission(
  submissionId: string,
  patch: { status?: AdminContactSubmission['status'] },
) {
  return apiCall<AdminContactSubmission>(
    `/v1/admin/contact-submissions/${submissionId}`,
    { method: 'PATCH', body: patch },
  );
}

export interface AdminActivityItem {
  kind: 'conversation' | 'order' | 'appointment';
  id: string;
  at: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  channel: string | null;
}

export type AdminLogCategory = 'config' | 'operation' | 'error';

export interface AdminGlobalLogItem {
  at: string;
  category: AdminLogCategory;
  label: string;
  title: string;
  subtitle: string | null;
  workspace_id: string | null;
  workspace_name: string;
}

export interface AdminUsageHistoryPoint {
  date: string;
  voice_minutes: number;
  whatsapp_messages: number;
  help_bot_turns: number;
}

export interface AdminErrorLogEntry {
  id: string;
  workspace_id: string | null;
  kind: 'crash' | 'integration';
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminKbModifierOption {
  id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
}

export interface AdminKbModifierGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  options: AdminKbModifierOption[];
}

export interface AdminKbMenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
  modifier_groups: AdminKbModifierGroup[];
}

export interface AdminKbCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface AdminKbSalonService {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
}

export interface AdminKbStaffHours {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface AdminKbSalonStaff {
  id: string;
  name: string;
  title: string | null;
  is_active: boolean;
  service_ids: string[];
  hours: AdminKbStaffHours[];
  google_connected: boolean;
  google_email: string | null;
}

export interface AdminKnowledgeBase {
  vertical: string;
  voice: {
    enabled: boolean;
    system_prompt: string;
    greeting: string;
    voice: string;
    model: string;
    language: string;
  } | null;
  categories: AdminKbCategory[];
  items: AdminKbMenuItem[];
  services: AdminKbSalonService[];
  staff: AdminKbSalonStaff[];
}

export function getAdminWorkspaceKnowledgeBase(workspaceId: string) {
  return apiCall<AdminKnowledgeBase>(`/v1/admin/workspaces/${workspaceId}/knowledge-base`, {
    cache: 'no-store',
  });
}

export function listAdminWorkspaceActivity(workspaceId: string) {
  return apiCall<AdminActivityItem[]>(`/v1/admin/workspaces/${workspaceId}/activity`, {
    cache: 'no-store',
  });
}

export function getAdminWorkspaceUsageHistory(workspaceId: string, days = 30) {
  return apiCall<AdminUsageHistoryPoint[]>(
    `/v1/admin/workspaces/${workspaceId}/usage-history?days=${days}`,
    { cache: 'no-store' },
  );
}

export function listAdminWorkspaceErrors(workspaceId: string) {
  return apiCall<AdminErrorLogEntry[]>(`/v1/admin/workspaces/${workspaceId}/errors`, {
    cache: 'no-store',
  });
}

export function listAdminAuditLogs(params: {
  actor_type?: string;
  action?: string;
  workspace_id?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.actor_type) qs.set('actor_type', params.actor_type);
  if (params.action) qs.set('action', params.action);
  if (params.workspace_id) qs.set('workspace_id', params.workspace_id);
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiCall<AdminAuditEntry[]>(`/v1/admin/audit-logs${suffix}`, { cache: 'no-store' });
}

export function listAdminGlobalLog(
  params: { workspace_id?: string; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.workspace_id) qs.set('workspace_id', params.workspace_id);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiCall<AdminGlobalLogItem[]>(`/v1/admin/logs${suffix}`, { cache: 'no-store' });
}

export function listAnnouncements() {
  return apiCall<Announcement[]>(`/v1/admin/announcements`, {
    cache: 'no-store',
  });
}

export function publishAnnouncement(payload: {
  title: string;
  body: string;
  link?: string | null;
}) {
  return apiCall<Announcement>(`/v1/admin/announcements`, {
    method: 'POST',
    body: payload,
    cache: 'no-store',
  });
}

export function listAdminUsage() {
  return apiCall<AdminWorkspaceUsageRow[]>(`/v1/admin/usage`, {
    cache: 'no-store',
  });
}

export function getAdminWorkspaceUsage(workspaceId: string) {
  return apiCall<UsageSummary>(`/v1/admin/workspaces/${workspaceId}/billing/usage`, {
    cache: 'no-store',
  });
}

export function listAdminWorkspaceGrants(workspaceId: string) {
  return apiCall<CreditGrant[]>(`/v1/admin/workspaces/${workspaceId}/billing/grants`, {
    cache: 'no-store',
  });
}

export function grantWorkspaceCredits(
  workspaceId: string,
  body: { credit_type: CreditType; amount: number; reason?: string },
) {
  return apiCall<CreditGrant>(`/v1/admin/workspaces/${workspaceId}/billing/grants`, {
    method: 'POST',
    body,
    cache: 'no-store',
  });
}

export function deductWorkspaceCredits(
  workspaceId: string,
  body: { credit_type: CreditType; amount: number; reason?: string },
) {
  return apiCall<{ deducted: number }>(`/v1/admin/workspaces/${workspaceId}/billing/deduct`, {
    method: 'POST',
    body,
    cache: 'no-store',
  });
}

export function updateAdminWorkspaceBilling(
  workspaceId: string,
  body: { plan?: PlanId; usage_enforcement_disabled?: boolean },
) {
  return apiCall<UsageSummary>(`/v1/admin/workspaces/${workspaceId}/billing`, {
    method: 'PATCH',
    body,
    cache: 'no-store',
  });
}

// --- Kiosk settings (admin-controlled) ---

export interface AdminKioskSettings {
  kiosk_enabled: boolean;
  max_kiosk_urls: number;
  theme: 'warm' | 'light' | 'gradient';
  session_lock_enabled: boolean;
  kiosk_monthly_limit: number;
  kiosk_credits_balance: number;
  kiosk_credits_used_this_month: number;
  kiosk_month_start: string | null;
}

export function getAdminKioskSettings(workspaceId: string) {
  return apiCall<AdminKioskSettings>(
    `/v1/admin/workspaces/${workspaceId}/kiosk-settings`,
    { cache: 'no-store' },
  );
}

export function updateAdminKioskSettings(
  workspaceId: string,
  body: { kiosk_enabled?: boolean; max_kiosk_urls?: number; kiosk_monthly_limit?: number },
) {
  return apiCall<AdminKioskSettings>(`/v1/admin/workspaces/${workspaceId}/kiosk-settings`, {
    method: 'PATCH',
    body,
  });
}

export function topupKioskCredits(workspaceId: string, amount: number) {
  return apiCall<AdminKioskSettings>(`/v1/admin/workspaces/${workspaceId}/kiosk-topup`, {
    method: 'POST',
    body: { amount },
  });
}

export interface KioskMetricsWindow {
  total_turns: number;
  deepgram_turns: number;
  avg_confidence: number | null;
  avg_chat_ms: number | null;
  avg_tts_ms: number | null;
  orders_placed: number;
}

export interface AdminKioskMetrics {
  window_7d: KioskMetricsWindow;
  window_30d: KioskMetricsWindow;
  window_all: KioskMetricsWindow;
}

export function getAdminKioskMetrics(workspaceId: string) {
  return apiCall<AdminKioskMetrics>(`/v1/admin/workspaces/${workspaceId}/kiosk-metrics`, {
    cache: 'no-store',
  });
}
