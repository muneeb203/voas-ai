import 'server-only';
import { apiCall } from './client';
import type {
  SupportMessage,
  SupportTicket,
  SupportTicketWithMessages,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/lib/types';

export interface AttachmentRef {
  path: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface TicketCreatePayload {
  subject: string;
  body: string;
  category: TicketCategory;
  priority: TicketPriority;
  attachments?: AttachmentRef[];
}

export interface SignedUploadResponse {
  path: string;
  signed_url: string;
  token: string | null;
  bucket: string;
  filename: string;
  content_type: string;
  size: number;
}

export function listTickets(workspaceId: string, statusFilter?: TicketStatus) {
  const qs = statusFilter ? `?status=${statusFilter}` : '';
  return apiCall<SupportTicket[]>(`/v1/workspaces/${workspaceId}/tickets${qs}`, {
    cache: 'no-store',
  });
}

export function getTicket(workspaceId: string, ticketId: string) {
  return apiCall<SupportTicketWithMessages>(
    `/v1/workspaces/${workspaceId}/tickets/${ticketId}`,
    { cache: 'no-store' },
  );
}

export function createTicket(workspaceId: string, payload: TicketCreatePayload) {
  return apiCall<SupportTicket>(`/v1/workspaces/${workspaceId}/tickets`, {
    method: 'POST',
    body: payload,
  });
}

export function addTicketMessage(
  workspaceId: string,
  ticketId: string,
  body: string,
  attachments?: AttachmentRef[],
) {
  return apiCall<SupportMessage>(
    `/v1/workspaces/${workspaceId}/tickets/${ticketId}/messages`,
    { method: 'POST', body: { body, attachments } },
  );
}

export function updateTicketStatus(workspaceId: string, ticketId: string, status: TicketStatus) {
  return apiCall<SupportTicket>(`/v1/workspaces/${workspaceId}/tickets/${ticketId}`, {
    method: 'PATCH',
    body: { status },
  });
}

export function createAttachmentUploadUrl(
  workspaceId: string,
  ticketId: string,
  payload: { filename: string; content_type: string; size: number },
) {
  return apiCall<SignedUploadResponse>(
    `/v1/workspaces/${workspaceId}/tickets/${ticketId}/attachments/upload-url`,
    { method: 'POST', body: payload },
  );
}
